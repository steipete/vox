import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { VoxConfig } from "../src/config.js";
import type { CallLogger } from "../src/logger.js";
import { handleTwilioSocket } from "../src/server.js";

function config(logDir: string): VoxConfig {
  return {
    openaiApiKey: "test",
    openaiRealtimeModel: "gpt-realtime",
    openaiRealtimeVoice: "marin",
    openaiRealtimeUrl: null,
    openaiInputAudioType: "audio/pcmu",
    openaiOutputAudioType: "audio/pcmu",
    openaiTranscriptionModel: "gpt-4o-transcribe",
    publicBaseUrl: new URL("https://vox.example.com"),
    agentUrl: null,
    agentCmd: null,
    agentTimeoutMs: 10_000,
    logDir,
    initialGreeting: null,
    twilioAccountSid: null,
    twilioAuthToken: null,
  };
}

function createLogger(baseDir: string, id: string): CallLogger {
  const dir = path.join(baseDir, id);
  fs.mkdirSync(dir, { recursive: true });
  return {
    dir,
    event() {},
    close() {},
  };
}

function fakeSocket() {
  const listeners: Record<string, ((data: any) => void)[]> = {};
  return {
    socket: {
      on: (event: string, cb: (data: any) => void) => {
        (listeners[event] ??= []).push(cb);
      },
      send() {},
      close() {},
    },
    emitMessage(data: string) {
      for (const cb of listeners.message ?? []) cb(data);
    },
  };
}

test("late Twilio start updates meta.json call ids", async (t) => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "vox-meta-"));
  t.after(() => fs.rmSync(logDir, { recursive: true, force: true }));
  const sock = fakeSocket();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(logDir),
    connect: async () => ({
      send() {},
      close() {},
      onServerEvent() {},
      onClose() {},
    }),
    createLogger,
  });

  const callDir = fs.readdirSync(logDir)[0];
  assert.ok(callDir);
  const metaPath = path.join(logDir, callDir, "meta.json");
  const before = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  assert.equal(before.callSid, null);
  assert.equal(before.streamSid, null);

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  const after = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  assert.equal(after.callSid, "CA1");
  assert.equal(after.streamSid, "MZ1");
  assert.equal(after.startedAt, before.startedAt);
});

test("a failed late metadata write does not escape the socket callback", async (t) => {
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "vox-meta-failure-"));
  t.after(() => fs.rmSync(logDir, { recursive: true, force: true }));
  const sock = fakeSocket();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(logDir),
    connect: async () => ({ send() {}, close() {}, onServerEvent() {}, onClose() {} }),
    createLogger,
  });
  const metaPath = path.join(logDir, fs.readdirSync(logDir)[0]!, "meta.json");
  fs.unlinkSync(metaPath);
  fs.mkdirSync(metaPath);
  assert.doesNotThrow(() =>
    sock.emitMessage(
      JSON.stringify({
        event: "start",
        start: { streamSid: "MZ1", callSid: "CA1" },
      }),
    ),
  );
  fs.rmdirSync(metaPath);
  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ2", callSid: "CA2" } }));
  assert.equal(JSON.parse(fs.readFileSync(metaPath, "utf8")).callSid, "CA2");
});
