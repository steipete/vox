import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { createInterface } from "node:readline";
import { safeJsonParse } from "./json.js";

export type AgentClient = {
  query: (args: unknown) => Promise<unknown>;
  close: () => void;
};

export function createHttpAgentClient(url: URL, timeoutMs: number): AgentClient {
  const closedController = new AbortController();

  return {
    async query(args: unknown) {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);
      const onClosed = () => controller.abort();
      closedController.signal.addEventListener("abort", onClosed);
      try {
        let res: Response;
        try {
          res = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(args),
            signal: controller.signal,
          });
        } catch (err) {
          if (timedOut) throw new Error(`Agent query timed out after ${timeoutMs}ms`);
          throw err;
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Agent HTTP ${res.status}: ${text}`);
        }
        const text = await res.text();
        const parsed = safeJsonParse<unknown>(text);
        return parsed.ok ? parsed.value : text;
      } finally {
        clearTimeout(timeout);
        closedController.signal.removeEventListener("abort", onClosed);
      }
    },
    close() {
      closedController.abort();
    },
  };
}

export function createSubprocessAgentClient(command: string, timeoutMs: number): AgentClient {
  const child = spawn(command, {
    shell: true,
    stdio: ["pipe", "pipe", "inherit"],
    env: process.env,
  });

  const rl = createInterface({ input: child.stdout });
  const pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void; timer: NodeJS.Timeout }
  >();

  rl.on("line", (line) => {
    const parsed = safeJsonParse<{ id?: string; result?: unknown; error?: unknown }>(line);
    if (!parsed.ok) return;
    const id = parsed.value.id;
    if (!id) return;
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (parsed.value.error) p.reject(parsed.value.error);
    else p.resolve(parsed.value.result ?? null);
  });

  const close = () => {
    rl.close();
    child.kill("SIGTERM");
    for (const [, p] of pending) {
      clearTimeout(p.timer);
      p.reject(new Error("Agent process closed"));
    }
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
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Agent query timed out after ${timeoutMs}ms`));
        }, timeoutMs);
        pending.set(id, { resolve, reject, timer });
      });
    },
    close,
  };
}
