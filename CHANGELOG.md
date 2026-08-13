# Changelog

## 0.2.2 - Unreleased

- Refresh eligible JavaScript dependencies and upgrade the GitHub Actions Node setup to v7.

## 0.2.1 - 2026-08-10

**Highlight:** patched Fastify routing dependencies — three high-severity
advisories (`fast-uri` host confusion and `find-my-way`) are cleared from the
live request path.

- Refresh runtime and build dependencies: Fastify 5.11.3 with patched `fast-uri` 3.1.5/4.1.2 and `find-my-way` 9.7.0, clearing three high-severity advisories in URL parsing and routing; plus ws, React 19.2.8, Vite 8.2.1, Tailwind, and the oxc toolchain.
- Hold `commander` 15 and pnpm 11 (both require a newer Node floor than vox's Node ≥22 contract) and `framer-motion` 13 (animation major pending rendered-behavior validation).

## 0.2.0 - 2026-07-02

- Add and publish the Vox marketing website at https://voxcli.sh with responsive product guidance and automated GitHub Pages deployment. Thanks @joeVenner.
- Add an opt-in timeout for HTTP and subprocess agent queries, recover voice responses after failures, and keep HTTP error details out of model-visible output. Thanks @joeVenner.
- Add regression coverage for repeated barge-ins keeping audio truncation within item bounds. Thanks @joeVenner.
- End calls promptly when the OpenAI Realtime connection drops, clean up calls that end during provider connection setup, and surface terminal disconnects in `vox simulate`. Thanks @joeVenner.
- Make packed installs launch the `vox` CLI directly.
- Preserve path prefixes in `VOX_PUBLIC_BASE_URL` when building TwiML and WebSocket endpoints. Thanks @joeVenner.
- Send one Realtime follow-up after all tool outputs from a response, preventing multi-tool calls from colliding and silencing the assistant follow-up. Thanks @joeVenner.
- Prevent late call-log and tool callbacks after teardown from crashing the Vox server. Thanks @joeVenner.
- Skip tool execution, report writes, and follow-up responses for cancelled Realtime responses. Thanks @joeVenner.
- Refresh Node.js types, the native TypeScript preview, and the pnpm 10.x toolchain.

## 0.1.0 - 2026-06-11

### Added

- Twilio Media Streams to OpenAI Realtime bridge with inbound and outbound calling, local simulation, agent tools, and per-call logs.

### Fixed

- Track acknowledged Twilio playback marks and the media presentation clock for exact barge-in truncation, remove unheard queued responses, and avoid redundant Realtime cancellation errors. Thanks @devYRPauli.
- Stabilize voice-call setup and align simulation payloads with the current Realtime API. Thanks @tallmaro.

### Changed

- Require Node.js 22 or 24 and upgrade GitHub Actions with least-privilege permissions and concurrency cancellation. Thanks @joeVenner.
- Adopt pnpm, oxlint, oxfmt, and tsgo for development and CI.
