# Vision

Vox is a small, self-hosted bridge for building reliable AI phone agents. It
connects telephony, realtime speech, and a user-owned agent without turning
into another hosted voice platform or general-purpose agent framework.

## Product principles

- **Stay thin.** Own call transport, lifecycle, interruption, observability,
  and the narrow tool boundary. Leave business logic to the user's agent.
- **Correct audio before more features.** Preserve native G.711 passthrough
  when providers support it. Treat playback position, barge-in, cancellation,
  and teardown as correctness-critical state.
- **Keep control with the operator.** Credentials, logs, agent processes, and
  deployment remain user-managed. New hosted dependencies need a clear reason
  and an explicit trust boundary.
- **Make real calls understandable.** Structured per-call logs and useful,
  non-secret error details should make failures diagnosable without exposing
  provider responses to callers or models.
- **Keep local iteration representative.** Simulation should exercise the same
  session and tool semantics as a live call wherever telecom transport is not
  required.
- **Prefer explicit contracts.** HTTP and JSONL adapters stay small and
  documented. Compatibility code needs an observed or published contract, not
  only a test that happens to exercise it.

## Boundaries

Vox is not a hosted calling service, a workflow/CRM product, a general media
processing stack, or a replacement for the user's agent. Features in those
directions should be separate integrations unless they directly improve the
bridge's reliability, operability, or documented extension points.

## Shipping policy

- Call-lifecycle and audio-timing fixes require focused regression coverage.
- Provider, telecom, and deployment changes require proof against the real
  contract, not only mocks or source inspection.
- Publishing boundaries use least-privilege credentials. A hosting cutover
  must prove the canonical domain, DNS, HTTPS, and built site before removing
  the previous path; skipping live proof requires an explicit owner waiver.
- User-visible behavior changes are documented and recorded in the changelog.
- Releases are deliberate: version, artifacts, notes, and public installation
  paths must agree before a release is considered shipped.
