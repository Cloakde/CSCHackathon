# TASK-102 — ElevenLabs Scribe Realtime Transport Spike

**Tier:** 1

**State:** BLOCKED pending schedule activation and engineer/reviewer assignment; explicit paid-smoke authorization is required only before provider traffic and PASS

**Assigned engineer:** Unassigned

**Independent reviewer:** Unassigned; must differ from the engineer

**Timebox:** One working day; checkpoint and hard PASS/CUT at expiry, no later than the activated M1 Day-5 gate

**Exact base commit:** `5e3c412c72801c54e1fe6e3143ec599257ee0a1f`

**Dependencies:** TASK-001; completed Schedule Activation Gate; explicit capped provider-smoke authorization for PASS

## Objective

Prove, without wiring Live into product UI, that already normalized synthetic PCM can obtain a protected temporary credential and produce the existing canonical `TranscriptEvent` union through ElevenLabs Scribe realtime. PASS must prove actual timestamp and reconnect behavior in one explicitly authorized short paid smoke. Otherwise CUT Live and preserve Simulation Mode.

## Owned Files

The assigned engineer may modify only:

- `.env.example`
- `shared/src/schemas/scribe.ts` — new; application token contract only, no raw provider event types
- `shared/src/index.ts` — only the new token-contract export; serialize this hotspot
- `shared/test/scribe.test.ts` — new
- `web/src/app/api/providers/elevenlabs/realtime-token/**` — new
- `web/src/lib/server/scribe/**` — new
- `extension/src/transcription/**` — new
- `extension/test/scribe-*.test.ts` — new
- `scripts/manual/run-local-scribe-spike.mjs` — new launcher/orchestrator
- `scripts/manual/scribe-realtime-smoke.mjs` — new
- `docs/adr/0005-elevenlabs-scribe-realtime-spike.md` — new

## Forbidden Paths and Lane Boundary

Do not modify:

- `docs/TASK_BOARD.md`, this task contract, workflow/milestone documents, or unrelated ADRs
- Root or workspace package manifests, `package-lock.json`, CI, or build configuration
- `extension/public/manifest.json`, `extension/src/background.ts`, `extension/src/App.tsx`, styles, offscreen files, or TASK-101 capture files
- Existing shared transcript, session, assistance, common, storage, grounding, or simulation schemas/implementation
- Other web routes or UI files

Do not commit or disclose an API key, token, token-bearing URL, real classroom audio/transcript, provider response containing sensitive material, balance, or account identifier. Do not add an SDK: use the server `fetch` and injected WebSocket/fetch adapters available in the existing toolchain.

## Contracts Consumed

- Existing `TranscriptSource`/snapshot interface
- `TranscriptEventSchema` and its immutable partial/committed chunk shapes
- ADR 0002: all sources use the same canonical event union
- ADR 0003: permanent credentials are server-only and provider content is untrusted
- Input seam: mono signed 16-bit little-endian PCM at 16 kHz, with absolute capture sample/offset metadata; a later integration task will derive it from TASK-101's captured stream

## Contracts Produced

- A runtime-validated application request/response schema for temporary transcription credentials
- Server-only schemas for ElevenLabs HTTP responses
- Extension-private schemas for raw provider socket events
- A provider-isolated `ScribeRealtimeTransport` seam that accepts validated PCM chunks and emits only existing `source.state`, `transcript.partial`, `transcript.committed`, and `source.error` events
- A measured PASS/CUT ADR recording protocol, cost, retention, timestamp-epoch, and reconnect evidence

No raw provider event type may escape the adapter, and this spike may not change the canonical transcript event union.

## Implementation Requirements

### Protected Token Route

`POST /api/providers/elevenlabs/realtime-token` must request a `realtime_scribe` single-use token from ElevenLabs with `xi-api-key` only on the server.

The route must:

- Be disabled by default and available only in explicitly configured loopback/local-spike mode
- Require a loopback Host, an exact allowlisted `chrome-extension://<id>` Origin, a one-run random capability header, the expected method/content type, a runtime-validated JSON body, and a small request-body limit
- Apply an upstream timeout and a hard two-token/two-connection issuance cap for the one-run capability before contacting ElevenLabs
- Handle exact-origin CORS and preflight without a wildcard; allow only the token POST, JSON content type, and the named one-run capability header
- Return only the one-use credential plus conservative expiry/configuration metadata
- Set `Cache-Control: no-store`
- Never cache or log a token, permanent key, upstream body, or token-bearing WebSocket URL
- Use a scope-restricted ElevenLabs key protected by a low dashboard credit quota during manual testing

Every disabled, malformed, wrong-origin, wrong-host, missing/wrong-capability, over-cap, or unauthorized request must fail before the upstream fetch.

`run-local-scribe-spike.mjs` must generate at least 128 bits of cryptographic randomness for a one-run capability, pass it only through child-process environment to the server and smoke harness without printing or persisting it, and start Next explicitly bound to `127.0.0.1` (or separately tested `::1`) rather than Next's default all-interface listener. It must refuse a non-loopback hostname, wait for verified readiness, invoke the smoke harness as its child, and tear down both children on success, failure, timeout, or operator interruption.

Child environments must be separately constructed from explicit allowlists rather than inherited wholesale. Only the server child receives `ELEVENLABS_API_KEY`. The harness receives the one-run capability and nonsecret connection/configuration values but no permanent provider key or other provider-secret variable. Neither secret may appear in child arguments. Automated tests must assert the spawned arguments, environment separation, and cleanup; manual evidence must verify the actual OS listener is loopback-only before the first provider call.

These loopback/origin/capability/issuance controls bound a local feasibility spike; they are not production user authorization. The route must remain disabled outside the local spike. A later deployment task must add an authenticated principal, per-user authorization, and durable distributed quotas before any public token endpoint can ship.

### Wire and Audio Contract

Connect to `wss://api.elevenlabs.io/v1/speech-to-text/realtime` with:

- A newly minted single-use token
- `model_id=scribe_v2_realtime`
- `audio_format=pcm_16000`
- `include_timestamps=true`
- An explicitly selected commit strategy recorded in the ADR
- A request for disabled logging, while treating the provider's retention response as authoritative

Do not enable keyterms, entity detection, or other premium features. Do not enable a documented option that conflicts with timestamps.

Accept only mono PCM16LE at 16 kHz. Each chunk carries absolute `startSample` and exclusive `endSample` offsets, must represent 0.1 to 1.0 seconds, and must contain exactly `(endSample - startSample) * 2` bytes. Reject the wrong rate, channels, alignment, byte count, duration, stale offset, gap, or overlap before any send.

### Provider Event Reconciliation

Runtime-validate all expected provider frames, including session start, partial transcript, committed/stable transcript, delayed committed transcript with timestamps, warnings, and documented errors. Unknown or malformed frames fail visibly and safely.

- Partial updates reuse one application `partialId` for the active segment.
- Because provider partial frames contain text but no timestamps, derive partial `startMs` from the active segment's first accepted PCM sample and `endMs` from the latest sample transmitted when that partial arrives. These are application capture bounds, not invented word timings; only the delayed provider timestamp event may finalize committed word timing.
- Do not emit an immutable app committed chunk until a stable commit is paired with valid positive timing.
- Pair a delayed timestamp event deterministically with its pending commit and reject mismatched, missing, duplicate, regressive, or invalid timing. If the provider supplies no correlation ID, use arrival order plus exact normalized-text equality; more than one possible match is an error, not a guess.
- Never synthesize timestamps or mutate an emitted chunk.
- Missing or ambiguous timing produces a visible recoverable source error.

The provider documents timestamp fields but does not clearly guarantee their epoch across a new WebSocket. The paid spike must measure and record this behavior. Do not assume it.

### Lecture Clock, Sequence, and Deduplication

- Maintain application session and sequence independently of provider session IDs.
- Translate provider seconds to application milliseconds using a per-connection base derived from absolute PCM sample offsets.
- Preserve all previously committed chunks across reconnects.
- Deduplicate before sequence allocation using a deterministic normalized text/time identity.
- Require each unique committed output to have positive duration and monotonic, non-overlapping offsets; do not silently clamp a regression.
- Never write audio to disk or browser storage; keep only bounded in-memory buffers.

### Reconnect and Stop

On an unexpected close or retryable provider error:

- Clear only partial/pending output and retain immutable committed chunks.
- Use bounded exponential backoff with injected clock/timers.
- Mint a fresh token for every connection attempt; never reuse, prefetch, or cache one.
- Send optional prior-text context only on the first audio chunk and keep it below 50 characters.
- Resume from a new connection base and deduplicate before emission.
- Keep the source visibly recovering; never switch silently to Simulation.

Audio already sent but not committed when a connection fails must not be replayed as if delivery were exactly-once. Discard that partial/pending segment, record and surface its exact PCM offset interval as a transcript gap, and resume from the first later contiguous sample on the new connection. Queued input with a stale, overlapping, or discontinuous sample range is rejected. The ADR must record this deliberate loss policy; a later integration may choose a more sophisticated buffer only with new deduplication evidence.

The spike transport has an injected absolute budget: at most 30 seconds of audio, 90 seconds of wall-clock time, two total connection attempts, two token issuances, and one reconnect. An audio chunk that would cross the 30-second input boundary is rejected before send; exactly 30 seconds may be sent and then only bounded transcript draining is allowed. Reaching the 90-second wall-clock deadline is terminal. Attempt, token, and reconnect counters allow operations through their stated maxima—including the required second token/socket—and reject with terminal cleanup only the next operation that would exceed a maximum. Every terminal limit cancels timers, closes the socket, clears bounded audio/pending buffers, prevents further issuance/sends, and surfaces the exhausted limit. Stop performs the same cleanup immediately and idempotently.

Authentication, quota, invalid-request, and unaccepted-terms failures are nonretryable. Rate, resource, queue, and session-limit behavior must be explicitly mapped, bounded, and surfaced. Code must never accept provider terms on a user's behalf.

### Warnings and Retention

- Surface distinct safe states for quota, rate limiting, unaccepted terms, session limit, and retention warnings.
- If requested disabled logging is not honored, display/record `RETENTION_ACTIVE`; never claim Zero Retention Mode.
- Record the actual account eligibility and provider response before a PASS.
- All transport uses HTTPS/WSS; no raw audio is retained by the application.

See the official [single-use token reference](https://elevenlabs.io/docs/api-reference/tokens/create), [realtime API](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime), [transcript/commit guidance](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/transcripts-and-commit-strategies), [event reference](https://elevenlabs.io/docs/eleven-api/guides/how-to/speech-to-text/realtime/event-reference), [authentication guidance](https://elevenlabs.io/docs/api-reference/authentication), and [retention guidance](https://elevenlabs.io/docs/eleven-api/resources/zero-retention-mode).

## Observable Acceptance Criteria

With fully injected fakes and zero network/spend:

- Disabled or invalid token requests never invoke the upstream adapter.
- Each allowed request yields one fresh opaque credential and cannot reveal the permanent key.
- Wrong PCM input cannot reach the socket.
- Valid partial updates replace one partial segment.
- One stable-plus-timestamps pair produces exactly one immutable canonical commit.
- Malformed, unmatched, duplicate, or regressive frames become visible safe errors rather than transcript corruption.
- Forced retryable disconnect preserves committed output, creates a new credential/socket, resumes with monotonic offsets, and emits no duplicate.
- A mid-segment disconnect surfaces the exact discarded PCM interval and never silently replays or hides it.
- The 30-second audio, 90-second wall-clock, two-attempt, two-token, and one-reconnect limits each terminate all work when exhausted.
- Stop prevents all later retries, token issuance, socket sends, or transcript events.
- Provider-specific types remain inside the adapter.
- The built extension contains neither `ELEVENLABS_API_KEY` nor `xi-api-key`, and all Simulation behavior remains green.

## Required Automated Verification

Use injected fetch, WebSocket, clock, timers, and ID sources. Tests must fail on any unstubbed network call.

Route coverage:

- Default-disabled behavior, method/content type/body size/schema
- Non-loopback Host, missing/wrong Origin, and missing/wrong one-run capability rejection
- Exact preflight/CORS, no-store, issuance cap, timeout, and safe upstream error mapping
- One fresh credential per successful request
- Permanent key appears only in a fake upstream header and never in returned/logged data
- Launcher generation/redaction of the one-run capability, explicit loopback-only Next hostname arguments, refusal of non-loopback configuration, and child cleanup
- Explicitly allowlisted child environments proving that only the server receives `ELEVENLABS_API_KEY`, the harness receives no permanent provider secret, and neither secret appears in process arguments

Protocol and transport coverage:

- Expected provider events, errors, warnings, malformed JSON, and unknown frames
- PCM format/duration/alignment plus exact byte-count/sample-range continuity rejection
- Partial replacement and commit/timestamp pairing
- One active socket, fresh credential per reconnect, bounded retry, and no retry for permanent failures
- Prior context only on the first chunk
- Commit deduplication, increasing app sequence, and monotonic non-overlapping offsets
- Mid-segment disconnect gap reporting with no replay, plus stale/gapped/overlapping post-reconnect input rejection
- Exact-boundary and would-exceed behavior for audio/wall-clock, connection, token, and reconnect budgets, including a successful second token/socket before any third attempt is rejected
- Stop cancellation and zero post-stop work

Run and report:

```text
npm run format:check
npm run lint
npm run secret:scan
npm run typecheck
npm run test --workspace=@livelecture/shared
npm run test --workspace=@livelecture/web
npm run test --workspace=@livelecture/extension
npm run build
npm run verify:extension-package
npm run check
git diff --check 5e3c412c72801c54e1fe6e3143ec599257ee0a1f...HEAD
git status --short
```

No live test belongs in CI or `npm run check`.

## Paid Manual Activation Gate

No provider request is authorized by this task contract alone. Before any request:

1. The Product Owner explicitly authorizes one capped smoke.
2. A human accepts any current ElevenLabs terms and verifies account eligibility.
3. Use a newly rotated, scope-restricted key with a hard dashboard credit quota; never reuse a key previously exposed in chat or logs.
4. Record current concurrency/session limits and the account's actual retention eligibility without recording sensitive balance/account data in Git.
5. Use only generated/synthetic speech or audio with separately documented participant consent.
6. Enable both `LIVE_SCRIBE_SPIKE_ENABLED=true` and the one-shot harness acknowledgment `RUN_PAID_SCRIBE_SMOKE=I_ACKNOWLEDGE_COST`.

The launcher must bind the actual Next listener to loopback, generate the one-run capability, and verify readiness. Before continuing, the operator must record OS-level evidence that the selected port is listening only on `127.0.0.1` or `::1`.

The smoke harness must exercise the delivered HTTP token route and instantiate the exact `extension/src/transcription/**` `ScribeRealtimeTransport`; it may only inject real fetch/WebSocket/clock adapters and capped configuration. It must not duplicate the provider URL builder, frame parser, reconciliation, retry, deduplication, or canonical-event mapping. Evidence must include the imported transport artifact/hash and canonical events validated through the existing `TranscriptEventSchema`.

The harness must reject audio longer than 30 seconds and print only redacted event names, timing, token-issuance count, listener address, transport artifact hash, canonical validation result, and an operator-entered cost delta. It must never print the one-run capability, credentials, account identifiers, raw audio, full transcript content, provider frames, or a token-bearing URL.

The exact-commit evidence must demonstrate:

- Provider session start
- At least one partial event, stable/committed event, and delayed timestamp event
- Usable positive word timestamps
- Forced disconnect in a new partial segment after at least one committed boundary, so the same single reconnect proves both committed preservation and explicit uncommitted-gap handling
- A second token issuance and socket
- One application session with no duplicate chunks and strictly increasing sequence/time
- A forced mid-segment failure whose uncommitted sample interval is visibly reported and not replayed
- Truthful visible recovery and Stop behavior in the harness
- Terminal cleanup at the configured audio/wall-clock/attempt/token/reconnect cap
- Duration, latency, issuance count, and redacted before/after credit delta
- Loopback-only OS listener evidence and the exact delivered transport artifact/hash
- Whether disabled logging was actually honored or a retention warning remained active

## Security and Privacy Requirements

- Permanent keys remain server-side and are never sent to or bundled with the extension.
- Temporary credentials are single-use, short-lived, uncached, and redacted.
- Token issuance is default-off, local-only, exact-origin restricted, rate/cost capped, and unavailable after Stop.
- Audio is memory-only and uses secure transport.
- Provider retention limitations are measured and disclosed, not guessed.
- No real classroom data enters automated tests or an unapproved manual run.
- The old key pasted into conversation history is treated as compromised and must not be used.

## PASS / CUT Decision

**PASS** requires:

- All automated commands green on the exact reviewed commit and a clean worktree
- Independent Tier-1 approval with no unresolved P1/P2 finding
- Explicitly authorized capped manual evidence satisfying every item above
- No credential, token, audio, transcript, or sensitive provider-response leak

This proves transport feasibility only. Live remains disabled until TASK-101 and a later integrated human capture/transcription preflight also pass.

**CUT** at the timebox/Day-5 gate if authorization, terms, or acceptable retention are unavailable; credential protection fails; required events/timestamps are absent or ambiguous; reconnect duplicates or regresses output; provider behavior cannot be bounded; or the cap is exceeded. Preserve the exact checkpoint and redacted cost/failure evidence, keep the token route disabled and unwired, and prove Simulation Mode remains green. Fake-only or partial evidence may never be reported as PASS.
