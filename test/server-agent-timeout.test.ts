import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { VoxConfig } from "../src/config.js";
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

test("a stalled agent query produces an error function_call_output instead of hanging the call", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  // The agent process never replies; with a 50ms timeout the query must
  // reject and the model must still get a function_call_output.
  const cfg = config({ agentCmd: `node -e "process.stdin.resume()"`, agentTimeoutMs: 50 });
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: cfg,
    connect: oa.connect,
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
          name: "query_agent",
          call_id: "call_1",
          arguments: '{"question":"what is the order status?"}',
        },
      ],
    },
  });

  await delay(200);

  const itemCreate = oa.sent.find((event: any) => event?.type === "conversation.item.create");
  assert.ok(itemCreate, "a function_call_output must be sent even when the agent times out");
  const output = JSON.parse(itemCreate.item.output);
  assert.equal(output.ok, false);
  assert.match(output.error, /timed out after 50ms/);
  assert.ok(
    oa.sent.some((event: any) => event?.type === "response.create"),
    "the model must get a follow-up response so it can tell the caller something went wrong",
  );

  sock.emitClose();
});
