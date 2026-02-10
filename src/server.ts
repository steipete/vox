import fs from "node:fs";
import path from "node:path";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { type AgentClient, createHttpAgentClient, createSubprocessAgentClient } from "./agent.js";
import type { VoxConfig } from "./config.js";
import { createCallLogger } from "./logger.js";
import { connectOpenAIRealtime } from "./openai.js";
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
  | { event: "stop"; streamSid?: string }
  | { event: string; [k: string]: any };

type TwilioOutboundMessage =
  | { event: "media"; streamSid: string; media: { payload: string } }
  | { event: "clear"; streamSid: string };

export async function startServer({ host, port, config }: StartServerOpts): Promise<void> {
  fs.mkdirSync(config.logDir, { recursive: true });

  const app = Fastify({ logger: false });
  await app.register(websocket);
  app.addContentTypeParser("application/x-www-form-urlencoded", (_req, _body, done) => done(null));

  app.get("/health", async () => ({ ok: true }));

  app.all("/twiml", async (_req, reply) => {
    if (!config.publicBaseUrl) {
      return reply
        .code(500)
        .type("text/plain")
        .send("Missing VOX_PUBLIC_BASE_URL (must be a public https URL Twilio can reach).");
    }

    const wsUrl = wsUrlFromPublicBase(config.publicBaseUrl, "/twilio");
    const xml = twimlForStream(wsUrl);
    return reply.type("text/xml").send(xml);
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

  await app.listen({ host, port });
  process.stdout.write(`vox serve listening on http://${host}:${port}\n`);
}

async function handleTwilioSocket(opts: {
  socket: any;
  req: any;
  config: VoxConfig;
}): Promise<void> {
  const { socket, config } = opts;

  let streamSid: string | null = null;
  let callSid: string | null = null;

  const logId = `call_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const logger = createCallLogger(config.logDir, logId);
  logger.event("vox", { type: "twilio.ws.connected" });

  const agent: AgentClient | null = config.agentUrl
    ? createHttpAgentClient(config.agentUrl)
    : config.agentCmd
      ? createSubprocessAgentClient(config.agentCmd)
      : null;

  const openai = await connectOpenAIRealtime({
    apiKey: config.openaiApiKey,
    model: config.openaiRealtimeModel,
  });

  let sessionReady = false;
  let lastAssistantItemId: string | null = null;
  let lastAssistantItemStartedAtMs: number | null = null;
  let responseInFlight = false;

  const audioQueue: string[] = [];
  const outboundAudioQueue: string[] = [];
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

  const clearPlayback = () => {
    if (!streamSid) return;
    sendTwilio({ event: "clear", streamSid });
  };

  const cancelResponse = () => {
    if (!responseInFlight) return;
    openai.send({ type: "response.cancel" });
  };

  const truncateAssistantItem = () => {
    if (!lastAssistantItemId || !lastAssistantItemStartedAtMs) return;
    const elapsedMs = Math.max(0, Date.now() - lastAssistantItemStartedAtMs);
    openai.send({
      type: "conversation.item.truncate",
      item_id: lastAssistantItemId,
      content_index: 0,
      audio_end_ms: elapsedMs,
    });
  };

  openai.onServerEvent((rawEvt) => {
    const evt = rawEvt as any;
    logger.event("openai", evt);

    const type = typeof evt?.type === "string" ? evt.type : "";

    if (type === "session.created") {
      openai.send({
        type: "session.update",
        session: {
          instructions:
            "You are Vox, a natural-sounding phone agent. Keep responses short (<= 2 sentences), ask one question at a time, and prefer confirming numbers/names. When you need information or actions, call the `query_agent` tool. If a tool call takes time, say a brief filler like 'One moment' and then continue. Avoid long lists.",
          audio: {
            input: {
              format: { type: config.openaiInputAudioType },
              turn_detection: {
                type: "server_vad",
                create_response: true,
                interrupt_response: true,
              },
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
              description:
                "Query the local/internal agent for facts, actions, or structured answers.",
              parameters: {
                type: "object",
                additionalProperties: false,
                properties: {
                  question: {
                    type: "string",
                    description: "What you want to ask the internal agent.",
                  },
                  context: {
                    type: "object",
                    description: "Optional context for the internal agent.",
                  },
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
        },
      });
      return;
    }

    if (type === "session.updated") {
      sessionReady = true;
      flushAudioQueue();
      if (config.initialGreeting) {
        openai.send({
          type: "response.create",
          response: {
            instructions: config.initialGreeting,
            output_modalities: ["audio"],
          },
        });
        responseInFlight = true;
      }
      return;
    }

    if (type === "input_audio_buffer.speech_started") {
      clearPlayback();
      cancelResponse();
      truncateAssistantItem();
      responseInFlight = false;
      return;
    }

    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      const delta = evt?.delta ?? evt?.audio?.delta ?? null;
      const itemId = evt?.item_id ?? evt?.itemId ?? null;
      if (typeof itemId === "string") {
        if (itemId !== lastAssistantItemId) {
          lastAssistantItemId = itemId;
          lastAssistantItemStartedAtMs = Date.now();
        }
      }
      if (typeof delta === "string" && delta.length > 0) {
        if (streamSid) sendTwilio({ event: "media", streamSid, media: { payload: delta } });
        else outboundAudioQueue.push(delta);
      }
      responseInFlight = true;
      return;
    }

    if (type === "response.output_audio.done" || type === "response.audio.done") {
      responseInFlight = false;
      lastAssistantItemStartedAtMs = null;
      return;
    }

    if (type === "response.done") {
      responseInFlight = false;
      void handleResponseDone({
        evt,
        openai,
        agent,
        logger,
        logDir: logger.dir,
        callContext: { callSid, streamSid },
      }).catch((err) => {
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

  socket.on("message", (data: any) => {
    const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
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
        for (const payload of outboundAudioQueue.splice(0, outboundAudioQueue.length)) {
          sendTwilio({ event: "media", streamSid, media: { payload } });
        }
      }
      return;
    }

    if (msg.event === "media") {
      const payload = msg.media?.payload;
      if (typeof payload !== "string") return;
      audioQueue.push(payload);
      if (audioQueue.length > 200) audioQueue.splice(0, audioQueue.length - 200);
      flushAudioQueue();
      return;
    }

    if (msg.event === "stop") {
      logger.event("vox", { type: "twilio.stop" });
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
      return;
    }
  });

  socket.on("close", () => {
    logger.event("vox", { type: "twilio.ws.closed" });
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
  });

  // persist some call metadata for debugging
  fs.writeFileSync(
    path.join(logger.dir, "meta.json"),
    JSON.stringify({ startedAt: new Date().toISOString(), callSid, streamSid }, null, 2),
  );
}

async function handleResponseDone(opts: {
  evt: any;
  openai: { send: (evt: unknown) => void };
  agent: AgentClient | null;
  logger: ReturnType<typeof createCallLogger>;
  logDir: string;
  callContext: { callSid: string | null; streamSid: string | null };
}): Promise<void> {
  const response = opts.evt?.response;
  const outputs: any[] = Array.isArray(response?.output) ? response.output : [];
  if (!outputs.length) return;

  for (const item of outputs) {
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
