import WebSocket from "ws";
import { safeJsonParse } from "./json.js";

export type RealtimeCloseInfo = {
  code: number;
  reason: string;
};

export type OpenAIRealtimeClient = {
  send: (evt: unknown) => void;
  close: () => void;
  onServerEvent: (handler: (evt: unknown) => void) => void;
  onClose: (handler: (info: RealtimeCloseInfo) => void) => void;
};

export function connectOpenAIRealtime(opts: {
  apiKey: string;
  model: string;
  /** Override the realtime endpoint (alternate gateways, local test servers). */
  url?: string | URL;
  /** Cancels connection establishment. Ignored after the socket opens. */
  signal?: AbortSignal;
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
    let opened = false;
    let closeHandler: ((info: RealtimeCloseInfo) => void) | null = null;
    let pendingClose: RealtimeCloseInfo | null = null;
    let lastError: Error | null = null;
    const abortHandshake = () => {
      const error = new Error("Realtime connection aborted");
      error.name = "AbortError";
      reject(error);
      try {
        ws.close();
      } catch {
        // ignore
      }
    };

    ws.once("open", () => {
      opened = true;
      opts.signal?.removeEventListener("abort", abortHandshake);

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

    // Keep one error listener for the socket's full lifetime. Before open it
    // rejects the handshake; afterward the close event owns terminal state.
    ws.on("error", (err) => {
      lastError = err;
      if (!opened) reject(err);
    });

    ws.once("close", (code: number, reason: Buffer) => {
      opts.signal?.removeEventListener("abort", abortHandshake);
      if (!opened) {
        reject(lastError ?? new Error(`Realtime connection closed during handshake (${code})`));
        return;
      }
      const closeReason = reason.toString("utf8");
      const info = { code, reason: closeReason || lastError?.message || "" };
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

    if (opts.signal?.aborted) {
      abortHandshake();
    } else {
      opts.signal?.addEventListener("abort", abortHandshake, { once: true });
    }
  });
}
