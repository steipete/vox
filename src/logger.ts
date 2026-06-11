import fs from "node:fs";
import path from "node:path";
import { jsonLine } from "./json.js";

export type CallLogger = {
  dir: string;
  event: (source: "twilio" | "openai" | "vox", payload: unknown) => void;
  close: () => void;
};

export function createCallLogger(baseDir: string, id: string): CallLogger {
  const dir = path.join(baseDir, id);
  fs.mkdirSync(dir, { recursive: true });
  const stream = fs.createWriteStream(path.join(dir, "events.jsonl"), { flags: "a" });
  let closed = false;

  // A WriteStream with no error listener turns any write failure (write after
  // end, ENOSPC) into an uncaught exception that kills every call on the
  // server. Logging must never take the bridge down.
  stream.on("error", (err) => {
    process.stderr.write(`vox: call log write failed for ${id}: ${err.message}\n`);
  });

  const event = (source: "twilio" | "openai" | "vox", payload: unknown) => {
    if (closed) return;
    stream.write(
      jsonLine({
        t: new Date().toISOString(),
        source,
        payload,
      }),
    );
  };

  const close = () => {
    if (closed) return;
    closed = true;
    stream.end();
  };

  return { dir, event, close };
}
