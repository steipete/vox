import WebSocket from "ws";
import { safeJsonParse } from "./json.js";

export type OpenAIRealtimeClient = {
  send: (evt: unknown) => void;
  close: () => void;
  onServerEvent: (handler: (evt: unknown) => void) => void;
  onClose: (handler: (info: { code: number; reason: string }) => void) => void;
};

export function connectOpenAIRealtime(opts: {
  apiKey: string;
  model: string;
  /** Override the realtime endpoint (alternate gateways, local test servers). */
  url?: string;
}): Promise<OpenAIRealtimeClient> {
  const url =
    opts.url ?? `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(opts.model)}`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
    },
  });

  const handlers = new Set<(evt: unknown) => void>();
  const buffered: unknown[] = [];

  return new Promise((resolve, reject) => {
    let closeHandler: ((info: { code: number; reason: string }) => void) | null = null;
    let pendingClose: { code: number; reason: string } | null = null;
    let lastError: Error | null = null;

    ws.once("open", () => {
      // The handshake reject listener must not linger: a settled promise
      // swallows the first mid-call error and leaves the next one unlistened,
      // which would crash the whole process. Record errors instead; the
      // "close" event that always follows carries the teardown.
      ws.removeListener("error", reject);
      ws.on("error", (err) => {
        lastError = err;
      });

      resolve({
        send(evt: unknown) {
          ws.send(JSON.stringify(evt));
        },
        close() {
          ws.close();
        },
        onServerEvent(handler) {
          handlers.add(handler);
          if (buffered.length) {
            for (const evt of buffered) handler(evt);
            if (handlers.size === 1) buffered.length = 0;
          }
        },
        onClose(handler) {
          closeHandler = handler;
          if (pendingClose) {
            handler(pendingClose);
            pendingClose = null;
          }
        },
      });
    });
    ws.once("error", reject);

    ws.once("close", (code: number, reason: Buffer) => {
      const info = { code, reason: lastError ? lastError.message : reason.toString("utf8") };
      if (closeHandler) closeHandler(info);
      else pendingClose = info;
    });

    ws.on("message", (data) => {
      const text = Buffer.isBuffer(data) ? data.toString("utf8") : String(data);
      const parsed = safeJsonParse<unknown>(text);
      if (!parsed.ok) return;
      if (!handlers.size) {
        buffered.push(parsed.value);
        if (buffered.length > 200) buffered.splice(0, buffered.length - 200);
        return;
      }
      for (const handler of handlers) handler(parsed.value);
    });
  });
}
