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
  let closeCount = 0;
  let handler: ((evt: unknown) => void) | null = null;
  return {
    sent,
    get closeCount() {
      return closeCount;
    },
    connect: async () => ({
      send: (evt: unknown) => {
        sent.push(evt);
      },
      close: () => {
        closeCount += 1;
      },
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
    emitMessage: (data: any) => {
      for (const cb of listeners.message ?? []) cb(data);
    },
    emitClose: () => {
      for (const cb of listeners.close ?? []) cb(undefined);
    },
  };
}

const media = (timestamp: number, payload = "AA==") =>
  JSON.stringify({ event: "media", media: { payload, timestamp: String(timestamp) } });

const mark = (name: string) => JSON.stringify({ event: "mark", mark: { name } });

const sentEvents = (sock: ReturnType<typeof fakeSocket>) => sock.sent.map((str) => JSON.parse(str));

// 5 seconds of mu-law audio (8 bytes/ms) delivered as a single Realtime burst.
const fiveSecondBurst = Buffer.alloc(8 * 5000).toString("base64");

test("outbound assistant audio is followed by a Twilio playback mark", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: fiveSecondBurst });

  const events = sentEvents(sock).filter(
    (event) => event.event === "media" || event.event === "mark",
  );
  assert.equal(events[0].event, "media");
  assert.equal(events[0].media.payload, fiveSecondBurst);
  assert.equal(events[1].event, "mark");
  assert.match(events[1].mark.name, /^vox-\d+$/);
});

test("barge-in truncates pending marked audio even after audio.done", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  for (const ts of [0, 100, 200]) sock.emitMessage(media(ts));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: fiveSecondBurst });
  oa.emit({ type: "response.output_audio.done", item_id: "itemA" });

  sock.emitMessage(media(1200));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  const truncate = oa.sent.find((event: any) => event?.type === "conversation.item.truncate");
  assert.ok(truncate, "a truncate must be sent while Twilio has not acked playback");
  assert.equal(truncate.item_id, "itemA");
  assert.equal(truncate.audio_end_ms, 1000);
  assert.ok(sentEvents(sock).some((event) => event.event === "clear"));
});

test("caller speech after acknowledged full playout does not truncate", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  for (const ts of [0, 100, 200]) sock.emitMessage(media(ts));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemC", delta: fiveSecondBurst });
  oa.emit({ type: "response.output_audio.done", item_id: "itemC" });

  const playbackMark = sentEvents(sock).find((event) => event.event === "mark")?.mark.name;
  assert.equal(typeof playbackMark, "string");
  sock.emitMessage(media(5200));
  sock.emitMessage(mark(playbackMark));
  sock.emitMessage(media(6000));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  assert.equal(
    oa.sent.some((event: any) => event?.type === "conversation.item.truncate"),
    false,
  );
});

test("overlap truncates the item Twilio is playing, not a later queued item", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  sock.emitMessage(media(0));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: fiveSecondBurst });
  oa.emit({ type: "response.output_audio.delta", item_id: "itemB", delta: fiveSecondBurst });
  sock.emitMessage(media(500));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  const truncate = oa.sent.find((event: any) => event?.type === "conversation.item.truncate");
  assert.ok(truncate);
  assert.equal(truncate.item_id, "itemA");
  assert.equal(truncate.audio_end_ms, 500);
});

test("socket close drops pending playback and closes OpenAI once", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: config(), connect: oa.connect });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });
  sock.emitMessage(media(0));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: fiveSecondBurst });

  sock.emitClose();
  sock.emitMessage(media(500));
  oa.emit({ type: "input_audio_buffer.speech_started" });

  assert.equal(oa.closeCount, 1);
  assert.equal(
    oa.sent.some((event: any) => event?.type === "conversation.item.truncate"),
    false,
  );
});
