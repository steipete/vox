import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { createInterface } from "node:readline";
import { safeJsonParse } from "./json.js";

export type AgentClient = {
  query: (args: unknown) => Promise<unknown>;
  close: () => void;
};

export function createHttpAgentClient(url: URL): AgentClient {
  const controller = new AbortController();

  return {
    async query(args: unknown) {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Agent HTTP ${res.status}: ${text}`);
      }
      const text = await res.text();
      const parsed = safeJsonParse<unknown>(text);
      return parsed.ok ? parsed.value : text;
    },
    close() {
      controller.abort();
    },
  };
}

export function createSubprocessAgentClient(command: string): AgentClient {
  const child = spawn(command, {
    shell: true,
    stdio: ["pipe", "pipe", "inherit"],
    env: process.env,
  });

  const rl = createInterface({ input: child.stdout });
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void }
  >();

  rl.on("line", (line) => {
    const parsed = safeJsonParse<{ id?: string; result?: unknown; error?: unknown }>(line);
    if (!parsed.ok) return;
    const id = parsed.value.id;
    if (!id) return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    if (parsed.value.error) p.reject(parsed.value.error);
    else p.resolve(parsed.value.result ?? null);
  });

  const close = () => {
    rl.close();
    child.kill("SIGTERM");
    for (const [, p] of pending) p.reject(new Error("Agent process closed"));
    pending.clear();
  };

  child.on("exit", () => close());

  return {
    async query(args: unknown) {
      const id = crypto.randomUUID();
      const payload = `${JSON.stringify({ id, type: "query", args })}\n`;
      if (!child.stdin.writable) throw new Error("Agent stdin not writable");
      child.stdin.write(payload);
      return await new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
      });
    },
    close,
  };
}
