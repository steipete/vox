import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { VoxConfig } from "../src/config.js";
import { handleTwilioSocket } from "../src/server.js";

function config(overrides: Partial<VoxConfig> = {}): VoxConfig {
  return {
    openaiApiKey: "test",
    openaiRealtimeModel: "gpt-realtime",
    openaiRealtimeVoice: "marin",
    openaiInputAudioType: "audio/pcmu",
    openaiOutputAudioType: "audio/pcmu",
    openaiTranscriptionModel: "gpt-4o-transcribe",
    publicBaseUrl: new URL("https://vox.example.com"),
    agentUrl: null,
    agentCmd: null,
    logDir: path.join(os.tmpdir(), `vox-test-${Date.now()}-${Math.random().toString(16).slice(2)}`),
    initialGreeting: null,
    twilioAccountSid: null,
    twilioAuthToken: null,
    ...overrides,
  };
}

function fakeOpenAI() {
  const sent: any[] = [];
  let handler: ((evt: unknown) => void) | null = null;
  return {
    sent,
    connect: async () => ({
      send: (evt: unknown) => {
        sent.push(evt);
      },
      close: () => {},
      onServerEvent: (h: (evt: unknown) => void) => {
        handler = h;
      },
    }),
    emit: (evt: unknown) => handler?.(evt),
  };
}

function fakeSocket() {
  const listeners: Record<string, ((data: any) => void)[]> = {};
  const sent: string[] = [];
  return {
    sent,
    socket: {
      on: (event: string, cb: (data: any) => void) => {
        (listeners[event] ??= []).push(cb);
      },
      send: (str: string) => {
        sent.push(str);
      },
      close: () => {},
    },
    emit: (data: any) => {
      for (const cb of listeners.message ?? []) cb(data);
    },
  };
}

const media = (timestamp: number, payload = "AA==") =>
  JSON.stringify({ event: "media", media: { payload, timestamp: String(timestamp) } });

// 5 seconds of mu-law audio (8 bytes/ms) delivered as a single Realtime burst.
const fiveSecondBurst = Buffer.alloc(8 * 5000).toString("base64");

test("barge-in truncates at the media-clock offset even after audio.done", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emit(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  // caller audio advances the stream clock to 200ms, then the assistant speaks
  for (const ts of [0, 100, 200]) sock.emit(media(ts));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: fiveSecondBurst });
  oa.emit({ type: "response.output_audio.done", item_id: "itemA" });

  // caller keeps streaming; at clock=1200 they cut in, 1000ms into a 5s reply
  sock.emit(media(1200));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  const truncate = oa.sent.find((e: any) => e?.type === "conversation.item.truncate");
  assert.ok(truncate, "a truncate must be sent even though audio.done already fired");
  assert.equal(truncate.item_id, "itemA");
  assert.equal(truncate.audio_end_ms, 1000);
});

test("caller speaking after full playout truncates at the generated length, not the elapsed clock", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emit(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  // caller audio advances the clock to 200ms, then the assistant delivers a 5s reply
  for (const ts of [0, 100, 200]) sock.emit(media(ts));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemC", delta: fiveSecondBurst });
  oa.emit({ type: "response.output_audio.done", item_id: "itemC" });

  // the caller hears the whole thing: the stream clock runs past responseStart + 5000ms
  // (6000 = 5800ms elapsed, beyond the 5000ms that was generated) before they speak again
  sock.emit(media(6000));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  const truncate = oa.sent.find((e: any) => e?.type === "conversation.item.truncate");
  assert.ok(truncate, "a truncate is still sent when the caller speaks after full playout");
  assert.equal(truncate.item_id, "itemC");
  // The caller heard all 5s, so truncation must report the full generated length,
  // not the larger elapsed offset (which would claim more audio than ever existed).
  assert.equal(truncate.audio_end_ms, 5000);
});

test("barge-in during playback truncates at the played-out offset", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emit(JSON.stringify({ event: "start", start: { streamSid: "MZ1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  sock.emit(media(300));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemB", delta: fiveSecondBurst });
  // no audio.done yet; caller cuts in at clock=800 (500ms in)
  sock.emit(media(800));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  const truncate = oa.sent.find((e: any) => e?.type === "conversation.item.truncate");
  assert.ok(truncate, "a truncate must be sent on barge-in");
  assert.equal(truncate.item_id, "itemB");
  assert.equal(truncate.audio_end_ms, 500);
});
