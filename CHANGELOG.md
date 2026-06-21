# Changelog

## 0.1.1 - Unreleased

- Add the Vox marketing website with responsive product guidance and verified static deployment configuration. Thanks @joeVenner.
- Add an opt-in timeout for HTTP and subprocess agent queries, recover voice responses after failures, and keep HTTP error details out of model-visible output. Thanks @joeVenner.
- End calls promptly when the OpenAI Realtime connection drops, clean up calls that end during provider connection setup, and surface terminal disconnects in `vox simulate`. Thanks @joeVenner.
- Make packed installs launch the `vox` CLI directly.
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
