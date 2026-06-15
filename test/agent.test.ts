import assert from "node:assert/strict";
import { createServer } from "node:http";
import path from "node:path";
import test from "node:test";
import { createHttpAgentClient, createSubprocessAgentClient } from "../src/agent.js";

test("subprocess agent JSONL roundtrip", async () => {
  const cmd = `node ${path.join("examples", "echo-agent.js")}`;
  const agent = createSubprocessAgentClient(cmd, 10_000);
  try {
    const res = await agent.query({ question: "hello" });
    const record = (res ?? {}) as Record<string, unknown>;
    assert.equal(record.ok, true);
    assert.match(String(record.answer ?? ""), /hello/);
  } finally {
    agent.close();
  }
});

test("subprocess agent query times out when the process never replies", async () => {
  const cmd = `node -e "process.stdin.resume()"`;
  const agent = createSubprocessAgentClient(cmd, 50);
  try {
    await assert.rejects(agent.query({ question: "hello" }), /timed out after 50ms/);
  } finally {
    agent.close();
  }
});

test("http agent query times out when the server never responds", async () => {
  const server = createServer((_req, _res) => {
    // Never respond — the client must give up on its own.
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected AddressInfo");

  const agent = createHttpAgentClient(new URL(`http://127.0.0.1:${address.port}/query`), 50);
  try {
    await assert.rejects(agent.query({ question: "hello" }), /timed out after 50ms/);
  } finally {
    agent.close();
    server.close();
  }
});

test("http agent recovers after a timeout for the next query on the same client", async () => {
  let requestCount = 0;
  const server = createServer((_req, res) => {
    requestCount += 1;
    if (requestCount === 1) {
      // First request hangs forever — the client must time out on its own.
      return;
    }
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, answer: "hi" }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("expected AddressInfo");

  const agent = createHttpAgentClient(new URL(`http://127.0.0.1:${address.port}/query`), 50);
  try {
    await assert.rejects(agent.query({ question: "first" }), /timed out after 50ms/);
    const result = (await agent.query({ question: "second" })) as Record<string, unknown>;
    assert.equal(result.ok, true);
    assert.equal(result.answer, "hi");
  } finally {
    agent.close();
    server.close();
  }
});
