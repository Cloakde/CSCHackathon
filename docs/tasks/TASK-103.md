# TASK-103 — Bounded AI Readiness, Phase A

**Tier:** 1

**State:** Contract IN REVIEW; implementation begins after independent approval

**Exact base:** `49ae3f88e7fc9b286e77449aea188c2acc8d2c5c`

**Coordinator:** Codex Coordinator

**Reviewer and temporary independent integrator:** `m3_review` (no implementation ownership)

**Timebox:** One implementation/review session; checkpoint external evidence separately

## Authorization and objective

The Product Owner instructed **“Execute next.”** This authorizes the next bounded, synthetic preparation for actual AI: keep uploading committed lecture passages while help is pending, support cancellable asynchronous generation and independent verification, and freeze/run the zero-provider readiness cases. It overrides the administrative schedule block for this phase only, sets no calendar dates, and does not establish actual AI or M3/M4 acceptance.

No provider, credential, spend, audio, browser/desktop control, original MeltingPot work, deployment, or existing-server switch is authorized. The existing lecture server at port 3000 and MeltingPot preview at port 3111 remain running. All generated help in normal runtime remains explicitly prewritten. Paid or actual-provider work is Phase B and requires its own provider/model, retention, cost reservation, capped authorization, and credentials.

## Frozen boundaries

- Consume unchanged shared wire schemas and canonical fixture. Do not change any `shared/src/schemas/**` bytes; MeltingPot's pinned contracts remain compatible.
- Add only optional `signal?: AbortSignal` to the server-internal `BuildImLostResponseCommand`, forwarding it through the existing helper. The store checks cancellation before work and immediately before its atomic write/return. Cancellation must not create a fallback confusion event. Signal is not serialized or part of the command fingerprint; cancellation of a follower must not cancel a different request's already-running command. Existing revision, identity, independent-verification and exact-command idempotency checks remain intact.
- `DemoDispatcherOptions.generateHelp(context, signal)` accepts a synchronous or asynchronous model result. Add `verifyHelp(candidate, signal)` as an injected independent verifier, defaulting to the existing separate scripted verifier. Inputs are cloned server-owned data. Runtime schemas validate untrusted outputs.
- `generatePractice(event, drillId, context)` may be asynchronous; context provides the completed session view and AbortSignal. Add an independently implemented `verifyPractice(candidate, signal)`. Its private runtime verdict must explicitly support all four checks: question supported, answer correct, explanation supported, and alignment with the confusion. It cannot approve merely because the generator declares success. Default scripted practice receives an independent exact-case/evidence verifier; unsupported or malformed verification yields a safe error and no cached drill. Helpers/types live under backend-owned `web/src/server/assistance/**`, not shared wire exports.
- Help's total generation, verification and one allowed stale-snapshot retry have one **10-second** deadline. Practice generation and verification have one **4-second** deadline, fitting the current MeltingPot relay's 5-second upstream bound. These are local engineering limits, not measured provider performance. They supersede the older draft's unapproved 15-second practice target for this phase.
- Abort on request cancellation and session deletion/expiry. Bound providers that ignore their signal using a raced deadline; never commit/cache their late results. Cleanup all operation timers/listeners and per-session in-flight state. At most one help generation and one practice generation may be active per session; a duplicate may return a safe busy result, and a completed repeated practice reuses its verified cache.
- On a changed authoritative snapshot, discard stale help and regenerate once from a fresh context within the same deadline. Reuse the logical response/confusion IDs. Retry only the stale-context case; do not retry malformed model output or relax grounding. If the second snapshot changes too, return the existing safe retryable error and record no stale event. An unsupported verifier still follows ADR 0003's fixed insufficient-evidence response if the request is current and not cancelled.
- The extension owns one ordered uploader per session, independent of Help's busy state. Only committed chunks are sent; partials remain local. Preserve chunks after failure, show explicit retry, and avoid automatic retry loops. Reset, source replacement, and unmount cancel uploader and foreground operations.
- Before Help, ensure already-visible chunks are acknowledged and capture a minimum accepted anchor. Continue uploading later chunks. Validate returned help against its own canonical anchor in the current session transcript, at least the minimum requested anchor, with exact context/evidence membership and citation timestamps. Never accept an arbitrary old same-session answer. Server revision/atomic checks remain authoritative; clients do not author timestamps or revision.
- Finish remains disabled during Help; afterward it stops replay, drains the same uploader, then completes the session. Both prototype and MeltingPot destinations remain explicit and unchanged.

## Exclusive implementation ownership

Frozen private backend seams, exported from `web/src/server/assistance/types.ts`:

```typescript
interface PracticeGenerationContext {
  view: CompletedSessionView;
  signal: AbortSignal;
}
interface PracticeVerificationCandidate {
  view: CompletedSessionView;
  confusionEvent: ConfusionEvent;
  drill: WeakAreaDrillResponse;
}
type PracticeSupportVerdict =
  | {
      verdict: "supported";
      supportedChecks: (
        "question_supported" | "answer_correct" | "explanation_supported" | "confusion_aligned"
      )[];
    }
  | { verdict: "unsupported" };
```

`PracticeSupportVerdictSchema` strictly validates the discriminated union; supported checks must contain all four unique values, with no missing/extra checks or fields. `generateHelp(context, signal)` and `generatePractice(event, drillId, context)` return their corresponding model/drill shape or Promise; hook output is still treated as untrusted at runtime. `verifyHelp(candidate, signal)` and `verifyPractice(candidate, signal)` return `unknown | Promise<unknown>`. `assistance/operation.ts` exports `HELP_DEADLINE_MS = 10_000` and `PRACTICE_DEADLINE_MS = 4_000`. No caller can raise these production limits through request input.

A stale retry begins only after the prior store transaction has settled and released its in-flight identity reservation. Cancellation of a coalesced follower rejects only that follower; it neither cancels the owner nor releases the owner's reservation. Owner cancellation settles/releases its own reservation, and no late verifier result can revive it. Exact successful retries retain their existing behavior.

The Coordinator adds an exported `StaleGroundingContextError` class in `shared/src/store.ts` for the existing transcript-revision mismatch only. The backend catches that type only around the settled store transaction. Generator failures, malformed output, mismatched model context, verifier failures and other store errors do not qualify for a stale retry. This is an internal error classification, not a wire schema change.

Each lane uses an isolated branch/worktree based on the approved contract revision. No concurrent writes to shared hotspots.

1. **Coordinator**, branch `coord/TASK-103-ai-readiness`: this contract, `docs/TASK_BOARD.md`, ADR 0006 and new ADR 0009, `README.md`, `package.json` for a dedicated readiness command; `shared/src/grounding.ts`, `shared/src/store.ts`, `shared/test/grounding.test.ts` for internal cancellation only; `web/src/server/ai-evaluation/**` and `docs/evaluations/TASK-103/**`; `web/src/components/help-ingestion.test.tsx`, existing `web/src/components/learning-demo.test.tsx` only if ordered uploads require a regression adjustment. The Coordinator lands the reviewed shared cancellation seam on the integration branch before backend integration.
2. **`m2_contract_review`**, now the backend implementing engineer for this task (not its reviewer/integrator): `web/src/server/demo-api.ts`, `web/src/server/demo-api.test.ts`, `web/src/server/assistance/**`, new `web/src/server/scripted-practice-verifier.ts` and its test. Existing scripted help/verifier and practice generators stay unchanged unless a narrow amendment is required. Implement the internal hooks, deadlines, retry and operation lifetime guards plus meaningful backend tests.
3. **`m3_extension`**, extension engineer: `extension/src/App.tsx`, new `extension/src/demo-uploader.ts`, `extension/test/App.test.tsx`, new `extension/test/demo-uploader.test.ts`. Existing API wire client, manifest, background and destination helpers remain unchanged.
4. **`m3_review`**, read-only independent exact-commit review, then independent promotion only after final approval and full green CI. This agent has no code ownership.

All MeltingPot paths, original repositories, provider adapters/network clients, dependencies/lockfiles, schema/fixture files, raw store writes, live transport and unrelated features are forbidden. Report necessary ownership amendments before editing them.

## Required evidence

- Existing shared, extension, prototype, MeltingPot paired component and ordinary production checks keep passing. Canonical schema parity remains exact. No existing local server is stopped; full ordinary HTTP checks run in CI.
- The preserved port-3000 server has the older backend. Once this task changes backend source, its prior paired production HTTP result is historical only. Run the unchanged MeltingPot relay/component against the new dispatcher in the zero-network paired test, and run the new ordinary production HTTP check in CI. A full paired production HTTP run on the new backend remains PENDING until a deliberate future local server update; never relabel reused old-server evidence as this candidate's result.
- Store tests prove abort before work and during verifier wait cannot record help/fallback, while exact retries and follower cancellation preserve existing identity semantics.
- Backend tests prove new chunks reach the real store during pending generation/verification, one retry uses the new context and records exactly one event, repeated changes fail safely, and malformed/unsupported/timeout/cancel/delete/expiry cases do not cache or record late content. Asynchronous practice must remain tied to the same completed session/event/concept/evidence and run an independent verifier.
- Actual extension-to-dispatcher test uses **1× simulation** and an injected delay to guarantee a committed passage reaches the server while Help is pending. Verify bounded retry, correct newer anchor, one event, citations, upload-failure retry, reset and Finish ordering. No browser, provider or external fetch is used.
- Freeze at least four canonical synthetic cases before using them: inner/outer (001–003); inner derivative (001–006); insufficient evidence (001–007 with 30-second lookback); instruction-like content plus sine-chain-rule evidence (001–009). Record expected concept, evidence and mathematical checks. Off-topic Q&A is out of delivered API scope.
- Report injected engineering PASS separately from actual model quality/latency/cost and human content review, which remain PENDING. A stub's result must never satisfy Phase B.
- Run targeted readiness tests, full relevant checks, exact independent reviews and final CI. Only the independent integrator may merge Coordinator-authored changes. Keep task/milestone status honest: preparation can be MERGED while actual AI evaluation remains open.

## Phase B gate

No network-capable provider adapter is activated in Phase A. Before a real trial, record provider/model selection, official current pricing and retention controls, per-attempt input/output/token bounds, maximum attempts and concurrency, worst-case cost reservation, a concrete hard cap, and user authorization. The old proposed $2/40-attempt draft is not spending permission. Do not ask to approve an unspecified provider run or report synthetic checks as model evidence.
