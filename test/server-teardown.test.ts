import assert from "node:assert/strict";
import fs from "node:fs";
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
    emitMessage: (data: any) => {
      for (const cb of listeners.message ?? []) cb(data);
    },
    emitClose: () => {
      for (const cb of listeners.close ?? []) cb(undefined);
    },
  };
}

test("hang-up during an in-flight agent query does not crash the process", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  // A real subprocess agent that accepts the query but never answers, so the
  // query is still pending when the caller hangs up.
  const cfg = config({ agentCmd: `node -e "process.stdin.resume()"` });
  await handleTwilioSocket({ socket: sock.socket, req: {}, config: cfg, connect: oa.connect });

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
  await delay(100);

  // cleanupCall() closes the agent and the logger; the pending query then
  // rejects ("Agent process closed") and handleResponseDone's catch handler
  // logs tool.error. Regression: that write hit the ended log stream and
  // emitted an unlistened ERR_STREAM_WRITE_AFTER_END, killing the server.
  sock.emitClose();
  await delay(150);

  const callDirs = fs.readdirSync(cfg.logDir);
  assert.equal(callDirs.length, 1);
  const events = fs
    .readFileSync(path.join(cfg.logDir, callDirs[0] ?? "", "events.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.ok(events.some((e) => e.payload?.type === "twilio.ws.closed"));
  assert.equal(
    events.some((e) => e.payload?.type === "tool.error"),
    false,
    "the post-teardown tool.error must be dropped, not written after close",
  );
});
