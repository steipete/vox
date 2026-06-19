#!/usr/bin/env node

import { Command } from "commander";
import "dotenv/config";
import { loadConfig } from "./config.js";
import { startServer } from "./server.js";
import { runSimulate } from "./simulate.js";
import { dialTwilioCall } from "./twilio.js";

const program = new Command();

program.name("vox").description("Phone calling bridge: Twilio ↔ OpenAI Realtime").version("0.1.0");

program
  .command("serve")
  .description("Start the Vox bridge server")
  .option("--host <host>", "Host to bind", "127.0.0.1")
  .option("--port <port>", "Port to bind", "3000")
  .action(async (opts) => {
    const config = loadConfig();
    const port = Number(opts.port);
    if (!Number.isFinite(port) || port <= 0) throw new Error(`Invalid --port: ${opts.port}`);
    await startServer({
      host: String(opts.host),
      port,
      config,
    });
  });

program
  .command("dial")
  .description("Place an outbound call via Twilio and connect to Vox /twiml")
  .argument("<to>", "Destination phone number in E.164, e.g. +14155550123")
  .requiredOption("--from <from>", "Caller ID / Twilio number in E.164")
  .option("--twiml-url <url>", "Override TwiML URL (defaults to VOX_PUBLIC_BASE_URL + /twiml)")
  .action(async (to, opts) => {
    const config = loadConfig();
    const twimlUrl =
      typeof opts.twimlUrl === "string" && opts.twimlUrl.length > 0
        ? opts.twimlUrl
        : config.publicBaseUrl
          ? (() => {
              const u = new URL(config.publicBaseUrl.toString());
              u.pathname = u.pathname.replace(/\/$/, "") + "/twiml";
              return u.toString();
            })()
          : null;

    if (!twimlUrl) {
      throw new Error(
        "Missing TwiML URL. Set VOX_PUBLIC_BASE_URL (public https base URL for your running `vox serve`) or pass --twiml-url.",
      );
    }

    const result = await dialTwilioCall({
      to,
      from: String(opts.from),
      url: twimlUrl,
      twilioAccountSid: config.twilioAccountSid,
      twilioAuthToken: config.twilioAuthToken,
    });

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  });

program
  .command("simulate")
  .description("Run a local (no-Twilio) simulation via stdin/stdout")
  .option("--no-play", "Do not play assistant audio")
  .option("--out <dir>", "Directory to write wav files", "")
  .action(async (opts) => {
    const config = loadConfig();
    const outDir = typeof opts.out === "string" && opts.out.length ? opts.out : config.logDir;
    await runSimulate({
      config,
      outDir,
      playAudio: Boolean(opts.play),
    });
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`vox: ${msg}\n`);
  process.exitCode = 1;
});
