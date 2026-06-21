import assert from "node:assert/strict";
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
    emitClose: () => {
      for (const cb of listeners.close ?? []) cb(undefined);
    },
  };
}

test("a response with multiple tool calls sends exactly one response.create", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(),
    connect: oa.connect,
    createLogger: createCallLogger,
  });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  oa.emit({
    type: "response.done",
    response: {
      output: [
        {
          type: "function_call",
          name: "save_call_report",
          call_id: "call_1",
          arguments: '{"report":{"reason":"first"}}',
        },
        {
          type: "function_call",
          name: "save_call_report",
          call_id: "call_2",
          arguments: '{"report":{"reason":"second"}}',
        },
      ],
    },
  });

  await delay(50);

  const responseCreates = oa.sent.filter((evt: any) => evt?.type === "response.create");
  assert.equal(
    responseCreates.length,
    1,
    `expected exactly 1 response.create but got ${responseCreates.length} — multiple tool calls must not each trigger a follow-up response`,
  );

  const itemCreates = oa.sent.filter((evt: any) => evt?.type === "conversation.item.create");
  assert.equal(itemCreates.length, 2, "expected one function_call_output per tool call");

  sock.emitClose();
});

test("a response with a single tool call still sends one response.create", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(),
    connect: oa.connect,
    createLogger: createCallLogger,
  });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  oa.emit({
    type: "response.done",
    response: {
      output: [
        {
          type: "function_call",
          name: "save_call_report",
          call_id: "call_1",
          arguments: '{"report":{"reason":"only"}}',
        },
      ],
    },
  });

  await delay(50);

  const responseCreates = oa.sent.filter((evt: any) => evt?.type === "response.create");
  assert.equal(
    responseCreates.length,
    1,
    "a single tool call must produce exactly one response.create",
  );

  sock.emitClose();
});
