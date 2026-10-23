import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { WebSocketServer, type WebSocket } from "ws";

async function waitUntil(ready: () => boolean) {
  const deadline = Date.now() + 10_000;
  while (!ready()) {
    assert.ok(Date.now() < deadline, "simulator did not reach the expected protocol state");
    await delay(10);
  }
}

async function simulator(t: TestContext, agentUrl?: string) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "vox-sim-tools-"));
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const messages: any[] = [];
  let socket: WebSocket | undefined;
  server.on("connection", (ws) => {
    socket = ws;
    ws.on("message", (data) => {
      const message = JSON.parse(String(data));
      messages.push(message);
      if (message.type === "session.update") ws.send(JSON.stringify({ type: "session.updated" }));
    });
    ws.send(JSON.stringify({ type: "session.created" }));
  });
  const cliArgs = process.env.VOX_TEST_CLI
    ? [process.env.VOX_TEST_CLI]
    : ["--import", "tsx", "src/cli.ts"];
  const child = spawn(process.execPath, [...cliArgs, "simulate", "--no-play", "--out", outDir], {
    env: {
      PATH: process.env.PATH,
      OPENAI_API_KEY: "synthetic-test-key",
      OPENAI_REALTIME_URL: `ws://127.0.0.1:${address.port}`,
      ...(agentUrl ? { VOX_AGENT_URL: agentUrl } : {}),
    },
    stdio: ["pipe", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += String(data);
  });
  child.stdout.resume();
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGINT");
      await exited;
    }
    for (const ws of server.clients) ws.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(outDir, { recursive: true, force: true });
  });
  await waitUntil(() => messages.some((m) => m.type === "session.update"));
  return {
    messages,
    child,
    stderr: () => stderr,
    send: (output: unknown[]) =>
      socket!.send(
        JSON.stringify({
          type: "response.done",
          response: { status: "completed", output },
        }),
      ),
  };
}

function tool(name: string, callId: string) {
  return { type: "function_call", name, call_id: callId, arguments: "{}" };
}

function continuation(messages: any[]) {
  return messages
    .filter((m) => m.type === "response.create" || m.item?.type === "function_call_output")
    .map((m) => m.item?.call_id ?? m.type);
}

test(
  "simulate CLI sends all tool outputs before its single follow-up",
  { timeout: 20_000 },
  async (t) => {
    const sim = await simulator(t);
    sim.send([tool("save_call_report", "report-1"), tool("save_call_report", "report-2")]);
    await waitUntil(() => sim.messages.some((m) => m.type === "response.create"));
    assert.deepEqual(continuation(sim.messages), ["report-1", "report-2", "response.create"]);
  },
);

test("simulate CLI stays busy while an agent tool is pending", { timeout: 20_000 }, async (t) => {
  let pending: http.ServerResponse | undefined;
  const agent = http.createServer((_req, res) => {
    pending = res;
  });
  agent.listen(0, "127.0.0.1");
  await once(agent, "listening");
  t.after(() => {
    pending?.end("{}");
    agent.close();
    agent.closeAllConnections();
  });
  const address = agent.address();
  assert.ok(address && typeof address !== "string");
  const sim = await simulator(t, `http://127.0.0.1:${address.port}`);
  sim.send([tool("save_call_report", "report"), tool("query_agent", "query")]);
  await waitUntil(() => Boolean(pending));
  sim.child.stdin.write("input while waiting\n");
  await waitUntil(
    () =>
      sim.stderr().includes("response in flight") ||
      sim.messages.some((m) => m.item?.role === "user"),
  );
  assert.match(sim.stderr(), /response in flight/);
  assert.ok(!sim.messages.some((m) => m.item?.role === "user"));
  pending!.end('{"answer":"ready"}');
  await waitUntil(
    () =>
      continuation(sim.messages).includes("query") &&
      continuation(sim.messages).includes("response.create"),
  );
  assert.deepEqual(continuation(sim.messages), ["report", "query", "response.create"]);
});
