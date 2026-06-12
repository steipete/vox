import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createCallLogger } from "../src/logger.js";

function tmpBaseDir() {
  return path.join(os.tmpdir(), `vox-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

async function readEventLines(dir: string): Promise<string[]> {
  const file = path.join(dir, "events.jsonl");
  for (let i = 0; i < 40; i += 1) {
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, "utf8");
      if (text.endsWith("\n")) return text.trim().split("\n");
    }
    await delay(25);
  }
  return [];
}

test("events before close are persisted as JSONL", async () => {
  const logger = createCallLogger(tmpBaseDir(), "call_persist");
  logger.event("twilio", { event: "start" });
  logger.event("vox", { type: "twilio.start" });
  logger.close();

  const lines = await readEventLines(logger.dir);
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0] ?? "");
  assert.equal(first.source, "twilio");
  assert.deepEqual(first.payload, { event: "start" });
});

test("event after close is dropped instead of crashing the process", async () => {
  const logger = createCallLogger(tmpBaseDir(), "call_late_event");
  logger.event("vox", { type: "twilio.stop" });
  logger.close();

  // Regression: a caller hang-up mid-`query_agent` made handleResponseDone's
  // catch handler log tool.error after cleanupCall() had ended the stream.
  // The write hit the ended stream and emitted an unlistened
  // ERR_STREAM_WRITE_AFTER_END, crashing the whole server process.
  logger.event("vox", { type: "tool.error", error: "Agent process closed" });

  const lines = await readEventLines(logger.dir);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0] ?? "").payload.type, "twilio.stop");

  // Give any stray stream error time to surface as an uncaught exception
  // (which would fail this test) before the test ends.
  await delay(50);
});

test("close is idempotent", async () => {
  const logger = createCallLogger(tmpBaseDir(), "call_double_close");
  logger.event("openai", { type: "session.created" });
  logger.close();
  logger.close();

  const lines = await readEventLines(logger.dir);
  assert.equal(lines.length, 1);
  await delay(50);
});
