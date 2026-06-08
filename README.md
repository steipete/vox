# vox

CLI + bridge server that connects **Twilio Media Streams** (PSTN phone calls) ↔ **OpenAI Realtime** (speech-to-speech) and lets the voice model call back into your local agent via tools.

This repo is intentionally “thin glue”: WebSocket proxying, barge-in/interrupt handling, logging, and a minimal tool adapter.

## What you get

- `vox serve`: HTTP endpoint that returns TwiML and a WebSocket endpoint Twilio streams audio to.
- `vox dial`: outbound calling via Twilio REST to connect a call to your running `vox serve`.
- OpenAI Realtime session configured for **G.711 μ-law passthrough** (`audio/pcmu`) so there’s no resampling/DSP required.
- `query_agent` tool that can call:
  - an HTTP endpoint (`VOX_AGENT_URL`), or
  - a local subprocess (`VOX_AGENT_CMD`, JSONL request/response).

## Requirements

- Node.js >= 22
- A public HTTPS URL to your laptop (Twilio needs to reach `/twiml` and `wss://.../twilio`). `ngrok` works fine.
- OpenAI API key
- Twilio account + a phone number (for PSTN calling)

## Setup

```bash
npm i
cp .env.example .env
```

Fill in at least:

- `OPENAI_API_KEY`
- `VOX_PUBLIC_BASE_URL` (the public HTTPS base URL that maps to your local server, e.g. your ngrok URL)

## Run

Start the bridge:

```bash
npm run dev -- serve --port 3000
```

Smoke check:

```bash
curl http://127.0.0.1:3000/health
```

### Inbound calls (recommended dev loop)

Point your Twilio Phone Number’s “A call comes in” webhook to:

- `GET https://<your-public-base>/twiml`

When you call that Twilio number, Twilio will stream the call to:

- `wss://<your-public-base>/twilio`

### Outbound calls

Set:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

Then dial:

```bash
npm run dev -- dial +14155550123 --from +14155550999
```

### Local simulation (no Twilio)

Useful for iterating on tool-calling and prompts without PSTN setup:

```bash
npm run dev -- simulate
```

Type a line, press enter, and Vox will respond (and write `.wav` files under `VOX_LOG_DIR`). Disable audio playback with `--no-play`.

## Local agent tool (`query_agent`)

The Realtime session registers a tool named `query_agent`. The voice model calls it whenever it needs facts/actions from your “real” agent.

### Option A: HTTP agent

Set `VOX_AGENT_URL` to an endpoint that accepts `POST` JSON and returns JSON (or plain text).

### Option B: Subprocess agent (JSONL)

Set `VOX_AGENT_CMD`, for example:

```bash
VOX_AGENT_CMD="node examples/echo-agent.js"
```

Protocol:

- Vox writes one JSON line:

```json
{"id":"...","type":"query","args":{...}}
```

- Your agent replies with one JSON line:

```json
{"id":"...","result":{...}}
```

See `examples/echo-agent.js`.

## Logs

Each call writes JSONL logs under `VOX_LOG_DIR`:

- `events.jsonl` (Twilio + OpenAI + Vox events)
- `meta.json` (simple call metadata)
- `report.json` (if the model calls `save_call_report`)

## Configuration

Environment variables (see `.env.example`):

- `OPENAI_API_KEY` (required)
- `OPENAI_REALTIME_MODEL` (default: `gpt-realtime`)
- `OPENAI_REALTIME_VOICE` (optional)
- `OPENAI_TRANSCRIPTION_MODEL` (default: `gpt-4o-transcribe`)
- `VOX_PUBLIC_BASE_URL` (required for `/twiml`)
- `VOX_AGENT_URL` or `VOX_AGENT_CMD` (optional)
- `VOX_LOG_DIR` (default: `./logs`)
- `VOX_INITIAL_GREETING` (optional)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` (required for `vox dial`)

## Development

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Safety / compliance notes

You are responsible for consent, recording rules, disclosure, and telecom compliance in the jurisdictions you call.
