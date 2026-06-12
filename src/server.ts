import fs from "node:fs";
import path from "node:path";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyInstance } from "fastify";
import { type AgentClient, createHttpAgentClient, createSubprocessAgentClient } from "./agent.js";
import type { VoxConfig } from "./config.js";
import { createCallLogger } from "./logger.js";
import { connectOpenAIRealtime } from "./openai.js";
import { base64ByteLength, createOutboundPlaybackTracker } from "./playback.js";
import { twimlForStream, wsUrlFromPublicBase } from "./twiml.js";

type StartServerOpts = {
  host: string;
  port: number;
  config: VoxConfig;
};

type TwilioInboundMessage =
  | { event: "connected" }
  | {
      event: "start";
      start: { streamSid: string; callSid?: string; accountSid?: string; customParameters?: any };
      streamSid?: string;
    }
  | {
      event: "media";
      streamSid?: string;
      media: { payload: string; track?: string; timestamp?: string };
    }
  | { event: "mark"; streamSid?: string; mark: { name?: string } }
  | { event: "stop"; streamSid?: string }
  | { event: string; [k: string]: any };

type TwilioOutboundMessage =
  | { event: "media"; streamSid: string; media: { payload: string } }
  | { event: "mark"; streamSid: string; mark: { name: string } }
  | { event: "clear"; streamSid: string };

export async function startServer({ host, port, config }: StartServerOpts): Promise<void> {
  fs.mkdirSync(config.logDir, { recursive: true });

  const app = await createVoxApp(config);
  await app.listen({ host, port });
  process.stdout.write(`vox serve listening on http://${host}:${port}\n`);
}

export async function createVoxApp(config: VoxConfig): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  await app.register(websocket);
  app.addContentTypeParser("application/x-www-form-urlencoded", (_req, _body, done) => done(null));

  app.get("/health", async () => ({ ok: true }));

  app.route({
    method: ["GET", "POST"],
    url: "/twiml",
    handler: async (_req, reply) => {
      if (!config.publicBaseUrl) {
        return reply
          .code(500)
          .type("text/plain")
          .send("Missing VOX_PUBLIC_BASE_URL (must be a public https URL Twilio can reach).");
      }

      const wsUrl = wsUrlFromPublicBase(config.publicBaseUrl, "/twilio");
      const xml = twimlForStream(wsUrl);
      return reply.type("text/xml").send(xml);
    },
  });

  app.get("/twilio", { websocket: true }, (connection, req) => {
    void handleTwilioSocket({ socket: connection, req, config }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      try {
        connection.close(1011, msg);
      } catch {
        // ignore
      }
    });
  });

  return app;
}

export async function handleTwilioSocket(opts: {
  socket: any;
  req: any;
  config: VoxConfig;
  connect?: typeof connectOpenAIRealtime;
  createLogger?: typeof createCallLogger;
}): Promise<void> {
  const { socket, config } = opts;
  const connect = opts.connect ?? connectOpenAIRealtime;
  const createLogger = opts.createLogger ?? createCallLogger;

  let streamSid: string | null = null;
  let callSid: string | null = null;

  const logId = `call_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const logger = createLogger(config.logDir, logId);
  logger.event("vox", { type: "twilio.ws.connected" });

  const earlyMessages = createEarlyTwilioMessageBuffer();
  socket.on("message", (data: any) => {
    earlyMessages.capture(data);
  });

  const agent: AgentClient | null = config.agentUrl
    ? createHttpAgentClient(config.agentUrl)
    : config.agentCmd
      ? createSubprocessAgentClient(config.agentCmd)
      : null;

  const openai = await connect({
    apiKey: config.openaiApiKey,
    model: config.openaiRealtimeModel,
    url: config.openaiRealtimeUrl ?? undefined,
  });

  let sessionReady = false;
  const playback = createOutboundPlaybackTracker();
  let closed = false;

  const audioQueue: string[] = [];
  const outboundAudioQueue: { itemId: string | null; payload: string }[] = [];
  const flushAudioQueue = () => {
    if (!sessionReady) return;
    while (audioQueue.length) {
      const payload = audioQueue.shift();
      if (!payload) continue;
      openai.send({ type: "input_audio_buffer.append", audio: payload });
    }
  };

  const sendTwilio = (msg: TwilioOutboundMessage) => {
    socket.send(JSON.stringify(msg));
  };

  const sendAssistantAudio = (itemId: string | null, payload: string) => {
    if (!streamSid) {
      outboundAudioQueue.push({ itemId, payload });
      return;
    }
    const mark = playback.onOutboundAudio(itemId, base64ByteLength(payload));
    sendTwilio({ event: "media", streamSid, media: { payload } });
    sendTwilio({ event: "mark", streamSid, mark: { name: mark.name } });
  };

  const clearPlayback = () => {
    if (!streamSid) return;
    sendTwilio({ event: "clear", streamSid });
    playback.clear();
  };

  const cleanupCall = () => {
    if (closed) return;
    closed = true;
    playback.clear();
    try {
      openai.close();
    } catch {
      // ignore
    }
    try {
      agent?.close();
    } catch {
      // ignore
    }
    logger.close();
  };

  const syncInterruptedPlayback = () => {
    const interruption = playback.interruption();
    if (interruption.truncation) {
      openai.send({
        type: "conversation.item.truncate",
        item_id: interruption.truncation.itemId,
        content_index: 0,
        audio_end_ms: interruption.truncation.audioEndMs,
      });
    }
    for (const itemId of interruption.deleteItemIds) {
      openai.send({ type: "conversation.item.delete", item_id: itemId });
    }
    playback.clear();
  };

  // A mid-call OpenAI disconnect must end the Twilio call too; otherwise the
  // caller sits in dead air on a bridge that can no longer answer, and the
  // agent client and logger leak until Twilio gives up.
  openai.onClose(({ code, reason }) => {
    if (closed) return;
    logger.event("vox", { type: "openai.ws.closed", code, reason });
    cleanupCall();
    try {
      socket.close();
    } catch {
      // ignore
    }
  });

  openai.onServerEvent((rawEvt) => {
    if (closed) return;
    const evt = rawEvt as any;
    logger.event("openai", evt);

    const type = typeof evt?.type === "string" ? evt.type : "";

    if (type === "session.created") {
      openai.send({
        type: "session.update",
        session: createRealtimeSessionConfig(config),
      });
      return;
    }

    if (type === "session.updated") {
      sessionReady = true;
      flushAudioQueue();
      if (config.initialGreeting) {
        openai.send({
          type: "response.create",
          response: createInitialGreetingResponse(config.initialGreeting),
        });
      }
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      syncInterruptedPlayback();
      clearPlayback();
      return;
    }

    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      const delta = evt?.delta ?? evt?.audio?.delta ?? null;
      const itemId = evt?.item_id ?? evt?.itemId ?? null;
      if (typeof delta === "string" && delta.length > 0) {
        sendAssistantAudio(typeof itemId === "string" ? itemId : null, delta);
      }
      return;
    }

    if (type === "response.output_audio.done" || type === "response.audio.done") {
      // Do not forget the item here: the Realtime API delivers the whole
      // response in a burst, so Twilio is still playing it out well after
      // "done". A barge-in during that window must still be able to truncate.
      return;
    }

    if (type === "response.done") {
      void handleResponseDone({
        evt,
        openai,
        agent,
        logger,
        logDir: logger.dir,
        callContext: { callSid, streamSid },
        isClosed: () => closed,
      }).catch((err) => {
        if (closed) return;
        logger.event("vox", {
          type: "tool.error",
          error: err instanceof Error ? err.message : String(err),
        });
      });
      return;
    }

    if (type === "error") {
      // Keep running; Twilio call should continue if possible.
      return;
    }
  });

  const handleTwilioMessage = (text: string) => {
    if (closed) return;
    let msg: TwilioInboundMessage;
    try {
      msg = JSON.parse(text) as TwilioInboundMessage;
    } catch {
      return;
    }
    logger.event("twilio", msg);

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid ?? msg.streamSid ?? null;
      callSid = msg.start?.callSid ?? null;
      logger.event("vox", { type: "twilio.start", streamSid, callSid });
      if (streamSid && outboundAudioQueue.length) {
        for (const chunk of outboundAudioQueue.splice(0, outboundAudioQueue.length)) {
          sendAssistantAudio(chunk.itemId, chunk.payload);
        }
      }
      return;
    }

    if (msg.event === "media") {
      // Twilio media timestamps are the presentation clock (ms from stream
      // start); they advance in real time and drive barge-in truncation.
      playback.onInboundMedia(Number(msg.media?.timestamp));
      const payload = msg.media?.payload;
      if (typeof payload !== "string") return;
      audioQueue.push(payload);
      if (audioQueue.length > 200) audioQueue.splice(0, audioQueue.length - 200);
      flushAudioQueue();
      return;
    }

    if (msg.event === "mark") {
      playback.onMark(String(msg.mark?.name ?? ""));
      return;
    }

    if (msg.event === "stop") {
      logger.event("vox", { type: "twilio.stop" });
      cleanupCall();
      return;
    }
  };

  // Stop early buffering, replay buffered messages, then handle live messages.
  earlyMessages.drain(handleTwilioMessage);
  socket.on("message", (data: any) => {
    const text = decodeSocketData(data);
    handleTwilioMessage(text);
  });

  socket.on("close", () => {
    if (closed) return;
    logger.event("vox", { type: "twilio.ws.closed" });
    cleanupCall();
  });

  // persist some call metadata for debugging
  fs.writeFileSync(
    path.join(logger.dir, "meta.json"),
    JSON.stringify({ startedAt: new Date().toISOString(), callSid, streamSid }, null, 2),
  );
}

export function decodeSocketData(data: unknown): string {
  return Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
}

export function createEarlyTwilioMessageBuffer() {
  const messages: string[] = [];
  let buffering = true;
  return {
    capture(data: unknown) {
      if (!buffering) return false;
      messages.push(decodeSocketData(data));
      return true;
    },
    drain(handler: (text: string) => void) {
      buffering = false;
      for (const text of messages) handler(text);
      messages.length = 0;
    },
    get size() {
      return messages.length;
    },
  };
}

export function createRealtimeSessionConfig(config: VoxConfig) {
  return {
    type: "realtime",
    instructions:
      "You are Vox, a natural-sounding phone agent. Keep responses short (<= 2 sentences), ask one question at a time, and prefer confirming numbers/names. When you need information or actions, call the `query_agent` tool. If a tool call takes time, say a brief filler like 'One moment' and then continue. Avoid long lists.",
    audio: {
      input: {
        format: { type: config.openaiInputAudioType },
        turn_detection: { type: "server_vad", create_response: true, interrupt_response: true },
        transcription: config.openaiTranscriptionModel
          ? { model: config.openaiTranscriptionModel }
          : undefined,
      },
      output: {
        format: { type: config.openaiOutputAudioType },
        voice: config.openaiRealtimeVoice ?? undefined,
      },
    },
    tools: [
      {
        type: "function",
        name: "query_agent",
        description: "Query the local/internal agent for facts, actions, or structured answers.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            question: { type: "string", description: "What you want to ask the internal agent." },
            context: { type: "object", description: "Optional context for the internal agent." },
          },
          required: ["question"],
        },
      },
      {
        type: "function",
        name: "save_call_report",
        description: "Persist a final call report to disk.",
        parameters: {
          type: "object",
          additionalProperties: true,
          properties: {
            report: { type: "object", description: "Arbitrary JSON report." },
          },
          required: ["report"],
        },
      },
    ],
    tool_choice: "auto",
  };
}

export function createInitialGreetingResponse(initialGreeting: string) {
  return {
    instructions: `Say exactly the following and nothing else: "${initialGreeting}"`,
    output_modalities: ["audio"],
  };
}

async function handleResponseDone(opts: {
  evt: any;
  openai: { send: (evt: unknown) => void };
  agent: AgentClient | null;
  logger: ReturnType<typeof createCallLogger>;
  logDir: string;
  callContext: { callSid: string | null; streamSid: string | null };
  isClosed: () => boolean;
}): Promise<void> {
  const response = opts.evt?.response;
  const outputs: any[] = Array.isArray(response?.output) ? response.output : [];
  if (!outputs.length) return;

  for (const item of outputs) {
    if (opts.isClosed()) return;
    if (item?.type !== "function_call") continue;
    const name = item?.name;
    const callId = item?.call_id;
    const argsText = item?.arguments;

    if (typeof name !== "string" || typeof callId !== "string") continue;
    let args: unknown = argsText;
    if (typeof argsText === "string") {
      try {
        args = JSON.parse(argsText) as unknown;
      } catch {
        args = { raw: argsText };
      }
    }

    if (name === "query_agent") {
      if (!opts.agent) {
        opts.openai.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ error: "No agent configured" }),
          },
        });
        opts.openai.send({ type: "response.create" });
        continue;
      }

      const result = await opts.agent.query({
        ...((typeof args === "object" && args !== null ? args : { args }) as any),
        call: opts.callContext,
      });
      if (opts.isClosed()) return;
      opts.openai.send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ ok: true, result }),
        },
      });
      opts.openai.send({ type: "response.create" });
      continue;
    }

    if (name === "save_call_report") {
      const reportPath = path.join(opts.logDir, "report.json");
      fs.writeFileSync(reportPath, JSON.stringify({ t: new Date().toISOString(), args }, null, 2));
      opts.openai.send({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify({ ok: true, path: reportPath }),
        },
      });
      opts.openai.send({ type: "response.create" });
    }
  }
}
