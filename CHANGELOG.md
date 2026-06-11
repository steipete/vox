# Changelog

## 0.1.1 - Unreleased

## 0.1.0 - 2026-06-11

### Added

- Twilio Media Streams to OpenAI Realtime bridge with inbound and outbound calling, local simulation, agent tools, and per-call logs.

### Fixed

- Track acknowledged Twilio playback marks and the media presentation clock for exact barge-in truncation, remove unheard queued responses, and avoid redundant Realtime cancellation errors. Thanks @devYRPauli.
- Stabilize voice-call setup and align simulation payloads with the current Realtime API. Thanks @tallmaro.

### Changed

- Require Node.js 22 or 24 and upgrade GitHub Actions with least-privilege permissions and concurrency cancellation. Thanks @joeVenner.
- Adopt pnpm, oxlint, oxfmt, and tsgo for development and CI.
