import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { type AgentClient, createHttpAgentClient, createSubprocessAgentClient } from "./agent.js";
import { mulawToPcm16 } from "./audio/mulaw.js";
import { wavFromPcm16le } from "./audio/wav.js";
import type { VoxConfig } from "./config.js";
import { createCallLogger } from "./logger.js";
import { connectOpenAIRealtime } from "./openai.js";

export async function runSimulate(opts: {
  config: VoxConfig;
  outDir: string;
  playAudio: boolean;
}): Promise<void> {
  fs.mkdirSync(opts.outDir, { recursive: true });
  const id = `simulate_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const logger = createCallLogger(opts.outDir, id);

  const agent: AgentClient | null = opts.config.agentUrl
    ? createHttpAgentClient(opts.config.agentUrl)
    : opts.config.agentCmd
      ? createSubprocessAgentClient(opts.config.agentCmd)
      : null;

  const openai = await connectOpenAIRealtime({
    apiKey: opts.config.openaiApiKey,
    model: opts.config.openaiRealtimeModel,
  });

  let sessionReady = false;
  let responseInFlight = false;
  let pendingAudioMulaw: Buffer[] = [];
  let lastAssistantText = "";

  const playWav = async (wavPath: string) => {
    if (!opts.playAudio) return;
    const platform = os.platform();
    const cmd = platform === "darwin" ? "afplay" : platform === "linux" ? "aplay" : null;
    if (!cmd) {
      process.stderr.write(`vox simulate: audio playback not supported on platform ${platform}\n`);
      return;
    }
    await new Promise<void>((resolve) => {
      const p = spawn(cmd, [wavPath], { stdio: "ignore" });
      p.on("exit", () => resolve());
      p.on("error", () => resolve());
    });
  };

  const flushAudioToFile = async () => {
    if (!pendingAudioMulaw.length) return;
    const mulawBytes = Buffer.concat(pendingAudioMulaw);
    pendingAudioMulaw = [];
    const pcm = mulawToPcm16(mulawBytes);
    const wav = wavFromPcm16le(pcm, 8000);
    const wavPath = path.join(logger.dir, `assistant_${Date.now()}.wav`);
    fs.writeFileSync(wavPath, wav);
    await playWav(wavPath);
  };

  const sendUserText = (text: string) => {
    openai.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });
    openai.send({ type: "response.create", response: { output_modalities: ["audio"] } });
    responseInFlight = true;
  };

  const handleToolCalls = async (evt: any) => {
    const response = evt?.response;
    const outputs: any[] = Array.isArray(response?.output) ? response.output : [];
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
        const result = agent
          ? await agent.query({
              ...((typeof args === "object" && args !== null ? args : { args }) as any),
            })
          : { error: "No agent configured" };

        openai.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ ok: true, result }),
          },
        });
        openai.send({
          type: "response.create",
          response: { output_modalities: ["audio"] },
        });
        responseInFlight = true;
        continue;
      }

      if (name === "save_call_report") {
        const reportPath = path.join(logger.dir, "report.json");
        fs.writeFileSync(
          reportPath,
          JSON.stringify({ t: new Date().toISOString(), args }, null, 2),
        );
        openai.send({
          type: "conversation.item.create",
          item: {
            type: "function_call_output",
            call_id: callId,
            output: JSON.stringify({ ok: true, path: reportPath }),
          },
        });
        openai.send({
          type: "response.create",
          response: { output_modalities: ["audio"] },
        });
        responseInFlight = true;
      }
    }
  };

  openai.onServerEvent((rawEvt) => {
    const evt = rawEvt as any;
    logger.event("openai", evt);
    const type = typeof evt?.type === "string" ? evt.type : "";

    if (type === "session.created") {
      openai.send({
        type: "session.update",
        session: {
          type: "realtime",
          instructions:
            "You are Vox in a local simulation. Respond naturally but concisely. Prefer calling `query_agent` for facts/actions.",
          audio: {
            input: {
              format: { type: opts.config.openaiInputAudioType },
              turn_detection: { type: "server_vad", create_response: false },
              transcription: opts.config.openaiTranscriptionModel
                ? { model: opts.config.openaiTranscriptionModel }
                : undefined,
            },
            output: {
              format: { type: opts.config.openaiOutputAudioType },
              voice: opts.config.openaiRealtimeVoice ?? undefined,
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
                properties: { report: { type: "object" } },
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
      if (opts.config.initialGreeting) {
        openai.send({
          type: "response.create",
          response: {
            instructions: opts.config.initialGreeting,
            output_modalities: ["audio"],
          },
        });
        responseInFlight = true;
      }
      return;
    }

    if (
      type === "response.output_text.delta" ||
      type === "response.text.delta" ||
      type === "response.output_audio_transcript.delta" ||
      type === "response.audio_transcript.delta"
    ) {
      const delta = evt?.delta ?? evt?.text?.delta ?? "";
      if (typeof delta === "string" && delta.length) {
        if (!lastAssistantText.length) process.stdout.write("assistant> ");
        process.stdout.write(delta);
        lastAssistantText += delta;
      }
      return;
    }

    if (
      type === "response.output_text.done" ||
      type === "response.text.done" ||
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done"
    ) {
      if (lastAssistantText.length) process.stdout.write("\n");
      lastAssistantText = "";
      return;
    }

    if (type === "response.output_audio.delta" || type === "response.audio.delta") {
      const delta = evt?.delta ?? evt?.audio?.delta ?? null;
      if (typeof delta === "string" && delta.length) {
        pendingAudioMulaw.push(Buffer.from(delta, "base64"));
      }
      return;
    }

    if (type === "response.done") {
      responseInFlight = false;
      void (async () => {
        await handleToolCalls(evt);
        await flushAudioToFile();
      })();
      return;
    }
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const closeAll = () => {
    try {
      rl.close();
    } catch {
      // ignore
    }
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
    try {
      logger.close();
    } catch {
      // ignore
    }
  };

  process.on("SIGINT", () => {
    closeAll();
    process.exit(0);
  });

  process.stdout.write("vox simulate: type messages and press enter (Ctrl+C to quit)\n");

  rl.on("line", (line) => {
    const text = line.trim();
    if (!text) return;
    if (!sessionReady) {
      process.stderr.write("vox simulate: session not ready yet\n");
      return;
    }
    if (responseInFlight) {
      process.stderr.write("vox simulate: response in flight; wait for completion\n");
      return;
    }
    sendUserText(text);
  });
}
