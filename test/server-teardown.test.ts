import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import type { VoxConfig } from "../src/config.js";
import type { CallLogger } from "../src/logger.js";
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

function strictLogger() {
  const state = {
    closeCount: 0,
    lateEventCount: 0,
    events: [] as { source: string; payload: any }[],
  };
  return {
    state,
    create(baseDir: string, id: string): CallLogger {
      const dir = path.join(baseDir, id);
      fs.mkdirSync(dir, { recursive: true });
      let closed = false;
      return {
        dir,
        event(source, payload) {
          if (closed) {
            state.lateEventCount += 1;
            return;
          }
          state.events.push({ source, payload });
        },
        close() {
          state.closeCount += 1;
          closed = true;
        },
      };
    },
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
  const logger = strictLogger();
  // A real subprocess agent that accepts the query but never answers, so the
  // query is still pending when the caller hangs up.
  const cfg = config({
    agentCmd: `${JSON.stringify(process.execPath)} -e "process.stdin.resume()"`,
  });
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: cfg,
    connect: oa.connect,
    createLogger: logger.create,
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
  await delay(100);

  // cleanupCall() closes the agent and the logger; the pending query then
  // rejects ("Agent process closed") and handleResponseDone's catch handler
  // logs tool.error. Regression: that write hit the ended log stream and
  // emitted an unlistened ERR_STREAM_WRITE_AFTER_END, killing the server.
  sock.emitClose();
  sock.emitMessage(JSON.stringify({ event: "stop", streamSid: "MZ1" }));
  sock.emitClose();
  await delay(150);

  assert.equal(oa.closeCount, 1);
  assert.equal(logger.state.closeCount, 1);
  assert.equal(logger.state.lateEventCount, 0, "teardown must suppress late logger callbacks");
  assert.ok(logger.state.events.some((event) => event.payload?.type === "twilio.ws.closed"));
  assert.equal(
    logger.state.events.some((event) => event.payload?.type === "tool.error"),
    false,
    "an expected teardown rejection must not be logged as a tool failure",
  );
  assert.equal(
    oa.sent.some(
      (event) => event?.type === "conversation.item.create" || event?.type === "response.create",
    ),
    false,
    "an in-flight tool must not resume the closed OpenAI session",
  );
});

test("Twilio stop followed by duplicate socket close tears down once", async () => {
  const oa = fakeOpenAI();
  const sock = fakeSocket();
  const logger = strictLogger();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(),
    connect: oa.connect,
    createLogger: logger.create,
  });

  sock.emitMessage(JSON.stringify({ event: "start", start: { streamSid: "MZ1", callSid: "CA1" } }));
  sock.emitMessage(JSON.stringify({ event: "stop", streamSid: "MZ1" }));
  sock.emitClose();
  sock.emitClose();
  oa.emit({ type: "error", error: { message: "late" } });

  assert.equal(oa.closeCount, 1);
  assert.equal(logger.state.closeCount, 1);
  assert.equal(logger.state.lateEventCount, 0);
  assert.ok(logger.state.events.some((event) => event.payload?.type === "twilio.stop"));
  assert.equal(
    logger.state.events.some((event) => event.payload?.type === "twilio.ws.closed"),
    false,
  );
  assert.equal(
    logger.state.events.some((event) => event.payload?.type === "error"),
    false,
  );
});
