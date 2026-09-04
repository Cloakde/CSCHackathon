# ADR 0003 — Provider Safety Boundary

**Status:** Accepted for bootstrap

## Context

Lecture transcripts and model output can both contain inaccurate, adversarial, or stale content. A model claiming that an answer is grounded is not sufficient evidence that its explanation follows from the transcript. The application also needs one authoritative record of exactly which committed transcript revision was used when a student requested help.

## Decision

Permanent transcription and generation credentials remain server-side. Browser code may receive only purpose-limited temporary credentials from protected endpoints.

Transcript and model content are untrusted data. Interfaces render escaped text or sanitized Markdown, and grounded calls receive no privileged tools or side effects.

The server owns grounding context creation. A client supplies a bounded lookback duration, but cannot choose the grounding anchor. The session store derives the anchor from the latest fully committed transcript chunk and returns an exact snapshot containing the session ID, transcript revision, time window, ordered chunk IDs, and canonical chunks. Model output must echo that exact context reference. Citation IDs are then hydrated from those server-owned chunks; the model cannot author citation timestamps or cite material outside the snapshot.

A separate semantic evidence verifier must independently evaluate the proposed grounded response and its cited chunks. A `supported` verdict is valid only when it accounts for every material diagnosis and concept claim. An unsupported verdict, malformed verdict, or verifier failure fails closed to a fixed server-authored insufficient-evidence response with no citations and exactly the safe `ask_follow_up` action. Model-authored fallback prose is never shown.

The only public persistence path is one verified build-and-record transaction. Its evaluator is an internal package module rather than part of the public barrel API. Store state and record-returning helpers use ECMAScript runtime-private fields, not TypeScript-only privacy. Before releasing a response, the store revalidates the authoritative latest-chunk anchor, exact transcript revision and snapshot, response/event linkage, and canonical citation IDs and timestamps. It then atomically records the full response, grounding context, and confusion event. Raw confusion-event and prebuilt-response write methods are not exposed.

The store fingerprints the normalized context, model output, and response/confusion identities before invoking the verifier. Exact retries return the already committed response without paying for or trusting a second verifier result; concurrent exact retries share one in-flight operation. Both confusion and response identities are reserved before verifier execution, so a changed or colliding command is rejected without unnecessary provider work. Session IDs are never reused after deletion, preventing an in-flight result from crossing into a later session incarnation.

CI checks secrets in every reachable Git commit. It checks out full history, verifies the downloaded Gitleaks archive against a pinned checksum, and runs Gitleaks with `--log-opts="--all"`. The local content scan remains a fast developer check, not a substitute for the history scan.

No paid or live provider is selected during bootstrap. Provider selection, latency, cost, retention, and fallback behavior require later measured ADRs.

## Consequences

- Grounded assistance can be returned only after both structural citation validation and independent semantic support verification.
- Stale transcript context causes the request to fail instead of quietly logging evidence against a newer transcript state.
- Insufficient evidence is explicit and predictable; it cannot relay untrusted model wording.
- A future persistent store must preserve these snapshot, atomicity, session-incarnation, and exact-command idempotency guarantees rather than weakening them during implementation.
