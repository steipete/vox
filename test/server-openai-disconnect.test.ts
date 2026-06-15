import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { VoxConfig } from "../src/config.js";
import type { CallLogger } from "../src/logger.js";
import { connectOpenAIRealtime } from "../src/openai.js";
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
  let closeHandler: ((info: { code: number; reason: string }) => void) | null = null;
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
      onClose: (h: (info: { code: number; reason: string }) => void) => {
        closeHandler = h;
      },
    }),
    emit: (evt: unknown) => handler?.(evt),
    emitConnectionClose: (info: { code: number; reason: string }) => closeHandler?.(info),
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
  let closeCount = 0;
  let closeArgs: unknown[] = [];
  return {
    sent,
    get closeCount() {
      return closeCount;
    },
    get closeArgs() {
      return closeArgs;
    },
    socket: {
      on: (event: string, cb: (data: any) => void) => {
        (listeners[event] ??= []).push(cb);
      },
      send: (str: string) => {
        sent.push(str);
      },
      close: (...args: unknown[]) => {
        closeCount += 1;
        closeArgs = args;
      },
    },
    emitMessage: (data: any) => {
      for (const cb of listeners.message ?? []) cb(data);
    },
    emitClose: () => {
      for (const cb of listeners.close ?? []) cb(undefined);
    },
  };
}

test("mid-call OpenAI disconnect tears the call down instead of leaving dead air", async () => {
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
  oa.emit({ type: "session.created" });
  oa.emit({ type: "session.updated" });

  // OpenAI drops the realtime session (network blip, server-side teardown).
  // Regression: the bridge never noticed — no log entry, the Twilio socket
  // stayed open with the caller in dead air, and the agent/logger leaked.
  oa.emitConnectionClose({ code: 1006, reason: "connection reset" });

  const wsClosed = logger.state.events.find((event) => event.payload?.type === "openai.ws.closed");
  assert.ok(wsClosed, "the disconnect must be visible in the call log");
  assert.equal(wsClosed?.payload.code, 1006);
  assert.equal(sock.closeCount, 1, "the Twilio socket must be closed to end the call");
  assert.deepEqual(sock.closeArgs, [1011, "Realtime connection closed"]);
  assert.equal(logger.state.closeCount, 1);
  assert.equal(oa.closeCount, 1);

  // Late traffic after teardown must be ignored, not crash or re-log.
  sock.emitMessage(JSON.stringify({ event: "media", media: { payload: "AA==" } }));
  oa.emit({ type: "response.output_audio.delta", item_id: "itemA", delta: "AA==" });
  sock.emitClose();
  assert.equal(logger.state.lateEventCount, 0);
  assert.equal(logger.state.closeCount, 1);
});

test("OpenAI close after normal teardown is a no-op", async () => {
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
  // cleanupCall() called openai.close(); the resulting close event must not
  // double-clean or log against the closed call.
  oa.emitConnectionClose({ code: 1000, reason: "" });

  assert.equal(oa.closeCount, 1);
  assert.equal(logger.state.closeCount, 1);
  assert.equal(logger.state.lateEventCount, 0);
  assert.equal(sock.closeCount, 0, "a call Twilio already ended must not be re-closed");
  assert.equal(
    logger.state.events.some((event) => event.payload?.type === "openai.ws.closed"),
    false,
  );
});

test("Twilio close during the OpenAI handshake aborts the pending connection", async () => {
  const sock = fakeSocket();
  const logger = strictLogger();
  let connectSignal: AbortSignal | undefined;
  const connect = (opts: Parameters<typeof connectOpenAIRealtime>[0]) =>
    new Promise<Awaited<ReturnType<typeof connectOpenAIRealtime>>>((_resolve, reject) => {
      connectSignal = opts.signal;
      opts.signal?.addEventListener(
        "abort",
        () => {
          const error = new Error("Realtime connection aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true },
      );
    });

  const handling = handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(),
    connect,
    createLogger: logger.create,
  });

  sock.emitClose();
  assert.equal(logger.state.closeCount, 1);
  assert.ok(logger.state.events.some((event) => event.payload?.type === "twilio.ws.closed"));
  await handling;

  assert.equal(connectSignal?.aborted, true);
  assert.equal(logger.state.closeCount, 1);
  assert.equal(sock.closeCount, 0);
});

test("OpenAI handshake failure closes all call resources once", async () => {
  const sock = fakeSocket();
  const logger = strictLogger();
  await handleTwilioSocket({
    socket: sock.socket,
    req: {},
    config: config(),
    connect: async () => {
      throw new Error("upstream unavailable");
    },
    createLogger: logger.create,
  });

  const connectFailed = logger.state.events.find(
    (event) => event.payload?.type === "openai.ws.connect_failed",
  );
  assert.equal(connectFailed?.payload.error, "upstream unavailable");
  assert.equal(logger.state.closeCount, 1);
  assert.equal(logger.state.lateEventCount, 0);
  assert.equal(sock.closeCount, 1);
  assert.deepEqual(sock.closeArgs, [1011, "Realtime connection failed"]);

  sock.emitClose();
  assert.equal(logger.state.closeCount, 1);
});
