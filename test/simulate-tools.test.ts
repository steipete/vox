import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { applySimulateToolCalls } from "../src/simulate.js";

test("one realtime response with two tool calls starts one follow-up", async () => {
  const sent: Array<{ type?: string }> = [];
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "vox-sim-"));
  const started = await applySimulateToolCalls({
    outputs: [
      {
        type: "function_call",
        name: "query_agent",
        call_id: "call-1",
        arguments: '{"question":"hi"}',
      },
      {
        type: "function_call",
        name: "save_call_report",
        call_id: "call-2",
        arguments: '{"report":{}}',
      },
    ],
    agent: null,
    isClosed: () => false,
    send: (event) => {
      sent.push(event as { type?: string });
    },
    logDir,
  });
  assert.equal(started, true);
  const creates = sent.filter((event) => event.type === "response.create");
  assert.equal(creates.length, 1);
  assert.equal(sent.filter((event) => event.type === "conversation.item.create").length, 2);
});
