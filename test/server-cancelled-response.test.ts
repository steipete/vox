import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { VoxConfig } from "../src/config.js";
import { createCallLogger } from "../src/logger.js";
import { handleTwilioSocket } from "../src/server.js";

function config(overrides: Partial<VoxConfig> = {}): VoxConfig {
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
      onClose: () => {},
    }),
    emit: (evt: unknown) => handler?.(evt),
  };
}

function fakeSocket() {
  const listeners: Record<string, ((data: any) => void)[]> = {};
  return {
    socket: {
      on: (event: string, cb: (data: any) => void) => {
        (listeners[event] ??= []).push(cb);
      },
      send: (_str: string) => {},
      close: () => {},
    },
    emitMessage: (data: any) => {
      for (const cb of listeners.message ?? []) cb(data);
    },
  };
}

test("a cancelled response does not execute its function calls", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  const cfg = config();
  let logDir = "";
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: cfg,
    connect: oa.connect,
    createLogger: (baseDir, id) => {
      const logger = createCallLogger(baseDir, id);
      logDir = logger.dir;
      return logger;
    },
  });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  oa.emit({
    type: "response.done",
    response: {
      status: "cancelled",
      output: [
        {
          type: "function_call",
          name: "query_agent",
          call_id: "call_1",
          arguments: '{"question":"what is the order status?"}',
        },
        {
          type: "function_call",
          name: "save_call_report",
          call_id: "call_2",
          arguments: "{}",
        },
      ],
    },
  });
  await delay(50);

  assert.equal(
    oa.sent.some((event: any) => event?.type === "conversation.item.create"),
    false,
    "a cancelled response must not produce function_call_output items",
  );
  assert.equal(
    oa.sent.some((event: any) => event?.type === "response.create"),
    false,
    "a cancelled response must not trigger a follow-up response",
  );
  assert.equal(
    fs.existsSync(path.join(logDir, "report.json")),
    false,
    "a cancelled save_call_report must not write a report",
  );
});
