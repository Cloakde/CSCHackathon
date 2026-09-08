# ADR 0005 — ElevenLabs Scribe Realtime Transport Spike

**Status:** Implemented offline; PASS/CUT decision DEFERRED. [TASK-102](../tasks/TASK-102.md) requires one explicitly authorized capped paid smoke run before PASS can be declared. No provider request has been made in this preparation phase — this ADR records the implemented design and the facts it rests on, it does not itself authorize spending.

## Correction after independent review — 2026-09-07

The original submission at `8336516` is CHANGES REQUESTED. Codex's correction is IN REVIEW; [current evidence and deferred manual procedure](../evaluations/TASK-101-102/README.md) supersede the earlier fake-only correctness claims. No provider was called. Ordinary capture and the token route are disabled by default; real feasibility still requires each task's own gate.

The correction fixes documented wire shapes and default canonical IDs, uses the first transmitted absolute sample for each socket's clock base, advances partial/gap boundaries after commits, bounds ordered timestamp pairing and checks duplicate identities before timing rejection. Socket readiness, stale callback isolation, cancellation, and whole-response HTTP deadlines are covered by regressions. The repaired manual launcher bundles the exact transport and validators, separates child credentials, verifies its actual loopback listener, and requires commits on both sides of one forced reconnect. Offline success does not establish live service compatibility or retention.

## Context

Prove that already-normalized synthetic PCM can obtain a protected temporary credential and produce the existing canonical `TranscriptEvent` union through ElevenLabs Scribe realtime, without wiring Live into the product UI. Prepared offline, without network access to ElevenLabs and without authorization to spend.

## Verified facts (checked 2026-09-07)

- **Token endpoint:** `POST https://api.elevenlabs.io/v1/single-use-token/{token_type}`. Three token types exist: `realtime_scribe`, `batch_scribe`, `tts_websocket`. Response: `{ token }`, documented as expiring after 15 minutes — not returned as a separate field, so the route reports a fixed `expiresInSeconds: 900` rather than inventing a tighter number the provider hasn't stated. [Tokens API reference](https://elevenlabs.io/docs/api-reference/tokens/create).
- **Realtime WebSocket:** `wss://api.elevenlabs.io/v1/speech-to-text/realtime`. Auth is either an `xi-api-key` header (permanent key — never used by the extension) or a `?token=` query parameter (the short-lived credential this spike mints). Because the token rides in the URL itself, that URL is never logged, and the smoke harness prints connection outcomes only, never the URL. [Realtime API reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime).
- **Commit strategy — `vad`, not `manual`.** ElevenLabs' own guide states manual is the default but requires the client to decide when to commit (with the model auto-committing after ~36 seconds either way); it explicitly recommends VAD for continuous, microphone-like audio: _"When transcribing audio from the microphone in the client-side integration, it is recommended to use the VAD strategy."_ A live lecture is exactly that shape of input. [Transcripts and commit strategies guide](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies).
- **Client-sent audio message:** `{ message_type: "input_audio_chunk", audio_base_64, sample_rate, commit: false, previous_text? }` — base64-encoded PCM, not raw binary WebSocket frames. `previous_text` is documented as optional context on the first chunk only.
- **Server-sent event types** (from the event reference table): `session_started`, `partial_transcript`, `committed_transcript`, `committed_transcript_with_timestamps`, `committed_transcript_entities` (unused — entity detection is not enabled), `warning`, `error`, and named error variants: `auth_error`, `unaccepted_terms`, `quota_exceeded`, `rate_limited`, `commit_throttled`, `queue_overflow`, `resource_exhausted`, `session_time_limit_exceeded`, `input_error`, `invalid_request`, `chunk_size_exceeded`, `insufficient_audio_activity`, `transcriber_error`. [Event reference](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference).
- **Retention:** `enable_logging: false` requests zero-retention mode, documented as enterprise-only. The transport requests it but never assumes it is honored — a `warning` frame surfaces to the caller separately (see below), and the task's own retention warning path is preserved for that reason.

**Documented wire fields:** the discriminator is `message_type`, not `type`. Timestamp items contain `text`, `start` and `end` in seconds, and may contain `type: "spacing"` entries; spacing has no citation-boundary authority. [JavaScript Scribe reference](https://elevenlabs.io/docs/eleven-api/resources/libraries/scribe-stt/javascript-scribe). These fields were checked in public documentation, not against a live account. Actual clock-epoch behavior and service compatibility still require the paid smoke.

## Decision

### Provider-isolated transport, one boundary in, one boundary out

`extension/src/transcription/scribe-transport.ts` accepts only already-normalized PCM chunks (`{startSample, endSample, bytes}`, mono 16-bit LE at 16 kHz, 0.1–1.0 s each) and emits only the existing canonical `TranscriptEvent` union — `source.state`, `source.error` and `transcript.partial`/`transcript.committed`. No raw ElevenLabs type crosses that boundary; `wire-events.ts` and `pcm.ts` are private to this directory.

Two pieces of information the canonical union has no slot for — provider warnings and a discarded-audio gap report — are surfaced through two small dedicated callbacks (`onWarning`, `onDiscardedGap`) instead of widening a frozen shared schema.

### Partial/commit/timestamp reconciliation

- One partial segment, one reused `partialId`, replaced (not appended) on every `partial_transcript` frame. Its `startMs`/`endMs` come from the _application's own_ PCM sample bounds for that segment (first accepted sample, latest transmitted sample) — never invented, matching the task's explicit prohibition on synthesizing timing from a frame that carries none.
- A `committed_transcript` frame is held, not emitted, in an ordered list bounded to 32 entries with a five-second timestamp deadline. Only once a _matching_ `committed_transcript_with_timestamps` frame arrives — matched by exact normalized-text equality, since the provider supplies no correlation ID — does the transport emit one immutable `transcript.committed` chunk, with `startMs`/`endMs` derived from the first and last word's provider-second timestamps translated through the current connection's first actually sent absolute sample offset.
- A text mismatch, a timestamps frame with no preceding commit, non-monotonic timing, or non-positive duration all become a visible `source.error`; none are ever silently repaired or guessed into an emission.
- Deduplication by normalized-text-plus-timing identity: an exact repeat (the most likely shape of a reconnect-boundary echo) is dropped without an error.

### Reconnect and budget

- Every connection attempt mints a fresh token — never reused, never prefetched.
- On an unexpected close, whatever was sent but never committed in the open segment is discarded and reported through `onDiscardedGap` with its exact PCM interval — never silently replayed as if delivery were exactly-once.
- Bounded exponential backoff (1 s, 2 s, 4 s, capped at 8 s, jittered) using an injectable timer, so tests never depend on real wall-clock delay.
- The budget (`maxAudioSeconds`, `maxWallClockMs`, `maxConnectionAttempts`, `maxTokenIssuances`, `maxReconnects`) is a constructor parameter, not a hard-coded property of the transport — the paid smoke harness applies the task's specific 30 s / 90 s / 2-attempt / 2-token / 1-reconnect caps; a later integration task can choose different, real-lecture-appropriate values without touching this module.
- Error codes are mapped to the existing frozen `ErrorCode` enum (`INVALID_REQUEST`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `INTERNAL_ERROR`) rather than inventing new ones; `auth_error`/`unaccepted_terms`/`invalid_request`/`input_error`/`chunk_size_exceeded`/`quota_exceeded` are treated as nonretryable per the task's own instruction, everything else as retryable.

### The protected token route

`web/src/app/api/providers/elevenlabs/realtime-token` is disabled unless both `LIVE_SCRIBE_SPIKE_ENABLED=true` and `RUN_PAID_SCRIBE_SMOKE=I_ACKNOWLEDGE_COST` are set outside CI, and every one of loopback Host, exact `chrome-extension://<id>` Origin, and a one-run random capability header must match before the request is even parsed — in that order, each failing the same generic way from the outside. A hard issuance cap is reserved _before_ the upstream mint call, so a slow or failed mint cannot let a concurrent request slip past it. The launcher provides the permanent `ELEVENLABS_API_KEY` only to the server process. The server-side token client uses it for minting; it never reaches the extension or smoke transport. Incoming and upstream response bodies have incremental byte limits and deadlines; authenticated HEAD readiness never mints a token.

## What is proven, and what is not

**Original offline claims were not sufficient:** the independent review reproduced 16 failing probes despite 480 passing existing tests. Consult the current correction evidence and handoff for the final source and results. Tests use fake network and synthetic audio; Stop emits its final stopped state and then prevents later sends/reconnects.

**Still unverified:** real word timing and epoch behavior across fresh sockets, actual logging/retention eligibility, provider reconnect latency and frame acceptance, and all human capture checks. Public documentation now establishes the wire fields above; the paid smoke must still prove the delivered adapter against the real service. It remains unauthorized in this offline correction.

## Consequences

- Live transcription remains fully inert until the capped smoke run in TASK-102 is separately authorized, executed, and reviewed. Nothing in this change enables Live in the product or spends anything.
- `scribe-transport.ts`'s constructor-supplied budget and its `TranscriptEvent`-only output are the exact seam TASK-307 (the integration task connecting capture, transport, and the existing lecture screen) is expected to consume — it should not need to touch `wire-events.ts` or `pcm.ts` at all.
