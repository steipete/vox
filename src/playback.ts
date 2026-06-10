// Twilio Media Streams use G.711 mu-law, 8 kHz mono: 8 bytes per millisecond.
const TWILIO_MULAW_BYTES_PER_MS = 8;

export type AssistantTruncation = { itemId: string; audioEndMs: number };
export type OutboundPlaybackMark = { name: string; durationMs: number };
export type PlaybackInterruption = {
  truncation: AssistantTruncation | null;
  deleteItemIds: string[];
};

type PendingChunk = {
  name: string;
  itemId: string | null;
  durationMs: number;
  startedAtMediaTimestampMs: number | null;
};

/** Decoded byte length of a base64 string, without allocating the decoded buffer. */
export function base64ByteLength(b64: string): number {
  if (typeof b64 !== "string" || b64.length === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(b64.length / 4) * 3 - padding);
}

export type OutboundPlaybackTracker = {
  /** Record the presentation timestamp of an inbound Twilio media frame. */
  onInboundMedia(timestampMs: number): void;
  /** Register an outbound media message and return the Twilio mark to send after it. */
  onOutboundAudio(itemId: string | null, audioByteLength: number): OutboundPlaybackMark;
  /** Record Twilio's acknowledgement that a mark has completed playback. */
  onMark(name: string): void;
  /** The assistant item currently being played, or null if Twilio has acked all queued audio. */
  truncation(): AssistantTruncation | null;
  /** OpenAI conversation updates needed when Twilio clears all unplayed audio. */
  interruption(): PlaybackInterruption;
  /** Drop pending playback state after Twilio clear/stream teardown. */
  clear(): void;
};

export function createOutboundPlaybackTracker(
  bytesPerMs: number = TWILIO_MULAW_BYTES_PER_MS,
): OutboundPlaybackTracker {
  let latestMediaTimestampMs = 0;
  let nextMarkId = 1;
  const pending: PendingChunk[] = [];
  const playedMsByItem = new Map<string, number>();

  const markPlayedThrough = (markIndex: number) => {
    for (let i = 0; i <= markIndex; i++) {
      const chunk = pending.shift();
      if (!chunk) break;
      if (chunk.itemId) {
        playedMsByItem.set(
          chunk.itemId,
          (playedMsByItem.get(chunk.itemId) ?? 0) + chunk.durationMs,
        );
      }
    }
    if (pending[0]?.startedAtMediaTimestampMs === null) {
      pending[0].startedAtMediaTimestampMs = latestMediaTimestampMs;
    }
  };

  return {
    onInboundMedia(timestampMs) {
      if (Number.isFinite(timestampMs) && timestampMs > latestMediaTimestampMs) {
        latestMediaTimestampMs = timestampMs;
      }
    },

    onOutboundAudio(itemId, audioByteLength) {
      const durationMs =
        Number.isFinite(audioByteLength) && audioByteLength > 0 && bytesPerMs > 0
          ? audioByteLength / bytesPerMs
          : 0;
      const mark = { name: `vox-${nextMarkId++}`, durationMs };
      pending.push({
        name: mark.name,
        itemId,
        durationMs,
        startedAtMediaTimestampMs: pending.length === 0 ? latestMediaTimestampMs : null,
      });
      return mark;
    },

    onMark(name) {
      if (!name) return;
      const markIndex = pending.findIndex((chunk) => chunk.name === name);
      if (markIndex === -1) return;
      markPlayedThrough(markIndex);
    },

    truncation() {
      const chunk = pending[0];
      if (!chunk?.itemId) return null;
      const startedAt = chunk.startedAtMediaTimestampMs ?? latestMediaTimestampMs;
      const playedWithinChunkMs = Math.min(
        chunk.durationMs,
        Math.max(0, latestMediaTimestampMs - startedAt),
      );
      return {
        itemId: chunk.itemId,
        audioEndMs: Math.round((playedMsByItem.get(chunk.itemId) ?? 0) + playedWithinChunkMs),
      };
    },

    interruption() {
      const truncation = this.truncation();
      const deleteItemIds: string[] = [];
      const keepItemId = truncation?.itemId ?? null;
      for (const chunk of pending) {
        if (!chunk.itemId || chunk.itemId === keepItemId || deleteItemIds.includes(chunk.itemId)) {
          continue;
        }
        deleteItemIds.push(chunk.itemId);
      }
      return { truncation, deleteItemIds };
    },

    clear() {
      pending.length = 0;
      playedMsByItem.clear();
    },
  };
}
