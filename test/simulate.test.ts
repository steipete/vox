import assert from "node:assert/strict";
import test from "node:test";
import type { VoxConfig } from "../src/config.js";
import { createSimulateAudioResponse, createSimulateSessionConfig } from "../src/simulate.js";

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
    logDir: "./logs",
    initialGreeting: "Hello from Vox.",
    twilioAccountSid: null,
    twilioAuthToken: null,
    ...overrides,
  };
}

test("simulate session update includes required realtime type", () => {
  const session = createSimulateSessionConfig(config()) as any;

  assert.equal(session.type, "realtime");
  assert.equal(session.audio.input.format.type, "audio/pcmu");
  assert.equal(session.audio.input.turn_detection.create_response, false);
  assert.equal(session.audio.output.format.type, "audio/pcmu");
  assert.equal(session.audio.output.voice, "marin");
});

test("simulate responses request audio only", () => {
  assert.deepEqual(createSimulateAudioResponse(), {
    output_modalities: ["audio"],
  });
  assert.deepEqual(createSimulateAudioResponse("Hello."), {
    instructions: "Hello.",
    output_modalities: ["audio"],
  });
});
