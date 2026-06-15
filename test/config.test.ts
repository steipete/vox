import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const prev: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    prev[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });
}

test("loadConfig throws without OPENAI_API_KEY", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: undefined,
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /OPENAI_API_KEY/);
    },
  );
});

test("loadConfig rejects VOX_AGENT_URL + VOX_AGENT_CMD together", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      VOX_AGENT_URL: "http://127.0.0.1:7777/query",
      VOX_AGENT_CMD: "node examples/echo-agent.js",
    },
    () => {
      assert.throws(() => loadConfig(), /VOX_AGENT_URL|VOX_AGENT_CMD/);
    },
  );
});

test("loadConfig parses OPENAI_REALTIME_URL and defaults it to null", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      OPENAI_REALTIME_URL: "ws://127.0.0.1:4242/realtime",
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.equal(loadConfig().openaiRealtimeUrl?.toString(), "ws://127.0.0.1:4242/realtime");
    },
  );
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      OPENAI_REALTIME_URL: undefined,
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.equal(loadConfig().openaiRealtimeUrl, null);
    },
  );
});

test("loadConfig rejects non-WebSocket OPENAI_REALTIME_URL values", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      OPENAI_REALTIME_URL: "https://example.com/realtime",
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /OPENAI_REALTIME_URL.*ws:\/\/ or wss:\/\//);
    },
  );
});

test("loadConfig defaults and parses VOX_AGENT_TIMEOUT_MS", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      VOX_AGENT_TIMEOUT_MS: undefined,
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.equal(loadConfig().agentTimeoutMs, 10_000);
    },
  );
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      VOX_AGENT_TIMEOUT_MS: "5000",
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.equal(loadConfig().agentTimeoutMs, 5000);
    },
  );
});

test("loadConfig rejects a non-positive VOX_AGENT_TIMEOUT_MS", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      VOX_AGENT_TIMEOUT_MS: "0",
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      assert.throws(() => loadConfig(), /VOX_AGENT_TIMEOUT_MS/);
    },
  );
});

test("loadConfig parses VOX_PUBLIC_BASE_URL", async () => {
  await withEnv(
    {
      OPENAI_API_KEY: "test",
      VOX_PUBLIC_BASE_URL: "https://example.com",
      VOX_AGENT_URL: undefined,
      VOX_AGENT_CMD: undefined,
    },
    () => {
      const cfg = loadConfig();
      assert.equal(cfg.publicBaseUrl?.toString(), "https://example.com/");
    },
  );
});
