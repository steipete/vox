// Audio on the Twilio Media Streams leg is always G.711 mu-law, 8 kHz mono,
// i.e. 8 bytes per millisecond of audio. We use this to bound the truncation
// point to the audio that was actually generated for an assistant turn.
const TWILIO_MULAW_BYTES_PER_MS = 8;

export type AssistantTruncation = { itemId: string; audioEndMs: number };

/** Decoded byte length of a base64 string, without allocating the decoded buffer. */
export function base64ByteLength(b64: string): number {
  if (typeof b64 !== "string" || b64.length === 0) return 0;
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor(b64.length / 4) * 3 - padding);
}

export type PlaybackTimeline = {
  /** Record the presentation timestamp of an inbound Twilio media frame (ms from stream start). */
  onInboundMedia(timestampMs: number): void;
  /** Record audio generated for an assistant item; byteLength is the decoded mu-law byte count. */
  onAssistantAudio(itemId: string, audioByteLength: number): void;
  /** The truncation to send to the Realtime API on barge-in, or null if there is nothing to truncate. */
  truncation(): AssistantTruncation | null;
  /** Forget the current assistant item (after it has been truncated). */
  clear(): void;
};

/**
 * Tracks how much of the assistant's current turn the caller has actually heard,
 * using Twilio's media-stream presentation clock rather than wall-clock time.
 *
 * The Realtime API streams a whole response in a burst that is far shorter than
 * its real playback duration, so wall-clock elapsed since the first audio chunk
 * is unrelated to how much audio has been played out. Twilio's inbound media
 * timestamps advance in real time, so `latestMediaTimestamp - responseStart`
 * is the played-out offset to truncate at.
 */
export function createPlaybackTimeline(
  bytesPerMs: number = TWILIO_MULAW_BYTES_PER_MS,
): PlaybackTimeline {
  let latestMediaTimestampMs = 0;
  let currentItemId: string | null = null;
  let responseStartMediaTimestampMs: number | null = null;
  let generatedAudioMs = 0;

  return {
    onInboundMedia(timestampMs) {
      if (Number.isFinite(timestampMs) && timestampMs > latestMediaTimestampMs) {
        latestMediaTimestampMs = timestampMs;
      }
    },

    onAssistantAudio(itemId, audioByteLength) {
      if (!itemId) return;
      if (itemId !== currentItemId) {
        currentItemId = itemId;
        responseStartMediaTimestampMs = latestMediaTimestampMs;
        generatedAudioMs = 0;
      }
      if (Number.isFinite(audioByteLength) && audioByteLength > 0 && bytesPerMs > 0) {
        generatedAudioMs += audioByteLength / bytesPerMs;
      }
    },

    truncation() {
      if (currentItemId === null || responseStartMediaTimestampMs === null) return null;
      const elapsedMs = Math.max(0, latestMediaTimestampMs - responseStartMediaTimestampMs);
      const audioEndMs = Math.min(elapsedMs, generatedAudioMs);
      return { itemId: currentItemId, audioEndMs: Math.round(audioEndMs) };
    },

    clear() {
      currentItemId = null;
      responseStartMediaTimestampMs = null;
      generatedAudioMs = 0;
    },
  };
}
