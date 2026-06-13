import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:net";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { type WebSocket, WebSocketServer } from "ws";
import { connectOpenAIRealtime } from "../src/openai.js";

async function startWss(): Promise<{ wss: WebSocketServer; url: string }> {
  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(wss, "listening");
  const address = wss.address();
  assert.ok(typeof address === "object" && address !== null);
  return { wss, url: `ws://127.0.0.1:${address.port}` };
}

function connectLocal(url: string) {
  return connectOpenAIRealtime({ apiKey: "test", model: "gpt-realtime", url });
}

test("server-initiated close reaches the onClose handler", async () => {
  const { wss, url } = await startWss();
  try {
    const serverSide: Promise<WebSocket> = once(wss, "connection").then(([ws]) => ws as WebSocket);
    const client = await connectLocal(url);

    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      client.onClose(resolve);
    });
    (await serverSide).close(1011, "session expired");

    assert.deepEqual(await closed, { code: 1011, reason: "session expired" });
  } finally {
    wss.close();
  }
});

test("close arriving before a handler is registered is buffered, not lost", async () => {
  const { wss, url } = await startWss();
  try {
    wss.on("connection", (ws) => ws.close(1000, "bye"));
    const client = await connectLocal(url);
    await delay(100);

    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      client.onClose(resolve);
    });
    assert.deepEqual(await closed, { code: 1000, reason: "bye" });
  } finally {
    wss.close();
  }
});

test("abrupt connection drop surfaces as onClose, not an unhandled error", async () => {
  const { wss, url } = await startWss();
  try {
    const serverSide: Promise<WebSocket> = once(wss, "connection").then(([ws]) => ws as WebSocket);
    const client = await connectLocal(url);

    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      client.onClose(resolve);
    });
    // No close frame: the client sees the TCP connection die mid-session.
    (await serverSide).terminate();

    const info = await closed;
    assert.equal(info.code, 1006);
  } finally {
    wss.close();
  }
});

test("send after the connection dropped is a no-op, not a crash", async () => {
  const { wss, url } = await startWss();
  try {
    const serverSide: Promise<WebSocket> = once(wss, "connection").then(([ws]) => ws as WebSocket);
    const client = await connectLocal(url);

    const closed = new Promise<void>((resolve) => {
      client.onClose(() => resolve());
    });
    (await serverSide).terminate();
    await closed;

    client.send({ type: "input_audio_buffer.append", audio: "AA==" });
    await delay(50);
  } finally {
    wss.close();
  }
});

test("aborting a pending handshake rejects and closes the transport", async () => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(typeof address === "object" && address !== null);

  const accepted = once(server, "connection");
  const controller = new AbortController();
  const connecting = connectOpenAIRealtime({
    apiKey: "test",
    model: "gpt-realtime",
    url: `ws://127.0.0.1:${address.port}`,
    signal: controller.signal,
  });

  const [socket] = await accepted;
  controller.abort();
  await assert.rejects(connecting, { name: "AbortError" });
  await once(socket, "close");
  server.close();
});

test("an already-aborted handshake signal rejects without an unhandled socket error", async () => {
  const { wss, url } = await startWss();
  const controller = new AbortController();
  controller.abort();

  try {
    await assert.rejects(
      connectOpenAIRealtime({
        apiKey: "test",
        model: "gpt-realtime",
        url,
        signal: controller.signal,
      }),
      { name: "AbortError" },
    );
    await delay(25);
  } finally {
    wss.close();
  }
});
