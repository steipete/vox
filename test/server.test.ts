import assert from "node:assert/strict";
import test from "node:test";
import type { VoxConfig } from "../src/config.js";
import {
  createEarlyTwilioMessageBuffer,
  createInitialGreetingResponse,
  createRealtimeSessionConfig,
  createVoxApp,
} from "../src/server.js";

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
    logDir: "./logs",
    initialGreeting: "Hello from Vox.",
    twilioAccountSid: null,
    twilioAuthToken: null,
    ...overrides,
  };
}

test("twiml endpoint accepts Twilio POST form requests", async () => {
  const app = await createVoxApp(config());
  try {
    const res = await app.inject({
      method: "POST",
      url: "/twiml",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      payload: "CallSid=CA123",
    });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers["content-type"] as string, /text\/xml/);
    assert.match(res.body, /wss:\/\/vox\.example\.com\/twilio/);
  } finally {
    await app.close();
  }
});

test("twiml endpoint does not accept unrelated methods", async () => {
  const app = await createVoxApp(config());
  try {
    const res = await app.inject({ method: "PUT", url: "/twiml" });
    assert.notEqual(res.statusCode, 200);
  } finally {
    await app.close();
  }
});

test("realtime session update includes required session type", () => {
  const session = createRealtimeSessionConfig(config()) as any;

  assert.equal(session.type, "realtime");
  assert.equal(session.audio.input.format.type, "audio/pcmu");
  assert.equal(session.audio.output.format.type, "audio/pcmu");
  assert.equal(session.audio.output.voice, "marin");
});

test("initial greeting is constrained to the configured text", () => {
  assert.deepEqual(createInitialGreetingResponse("Hello there."), {
    instructions: 'Say exactly the following and nothing else: "Hello there."',
    output_modalities: ["audio"],
  });
});

test("early Twilio message buffer replays messages in arrival order", () => {
  const buffer = createEarlyTwilioMessageBuffer();
  assert.equal(buffer.capture(Buffer.from('{"event":"connected"}')), true);
  assert.equal(buffer.capture('{"event":"start"}'), true);
  assert.equal(buffer.size, 2);

  const replayed: string[] = [];
  buffer.drain((text) => replayed.push(text));

  assert.deepEqual(replayed, ['{"event":"connected"}', '{"event":"start"}']);
  assert.equal(buffer.size, 0);
  assert.equal(buffer.capture('{"event":"media"}'), false);
});
