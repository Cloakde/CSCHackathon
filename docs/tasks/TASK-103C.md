# TASK-103C — Replace the inactive assistance trial with Gemini

- **Tier:** 1
- **State:** ASSIGNED — offline implementation only
- **Implementer:** Claude, when the user starts its turn
- **Senior lead:** Codex
- **Independent review:** Gemini on the next turn, or Codex; never Claude approving its own implementation
- **Branch/folder:** `shared/livelecture` in `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon`

**Verified starting point for this assignment:** clean local/remote `48172a2b82e9615b4fc1b39217b37868ae006d09`, containing main `8cfa83b88c0f6186d3475266b005069da4fbe820`. Start from the current shared head containing this contract, record that exact hash, and inspect any intervening changes. Do not reset to either historical hash. This contract follows the user's direct provider choice and implementation assignment; no paid run is authorized.

## Deliverable

Make the existing separately invoked synthetic trial use the **Gemini API** for all four hooks: Help generation, Help verification, practice generation and practice verification. Preserve the working, labelled prewritten demo. The trial must stay inactive by default and make zero provider calls in ordinary tests, builds and launches. No fallback to OpenAI.

The user-facing result is a ready-to-review Gemini trial, a short setup/runbook and an honest handoff. It is not an activated real-AI product or live transcription feature.

## Owned paths

- `web/src/server/assistance/provider-trial/**`: Gemini transport, schemas, prompts and injected tests.
- `web/src/server/ai-evaluation/trial/**`: private policy/usage/accounting adaptation, report metadata, guarded runner and their tests. Preserve the existing scenario and timing checks.
- `scripts/ai-trial.mjs`, `scripts/ai-trial.test.mjs`, `scripts/ai-trial-vitest.config.ts`: offline plan, credential guards and explicit run entry point.
- `docs/tasks/TASK-103C.md`, `docs/adr/0012-gemini-assistance-direction.md`, `docs/evaluations/TASK-103/PHASE-B.md`, `docs/evaluations/TASK-103/README.md`, and the trial paragraphs of `README.md`: current Gemini configuration and evidence; retain historical OpenAI results as historical.
- `docs/HANDOFF.md` and the relevant TASK-103C status/evidence in `docs/TASK_BOARD.md`.

Do not change extension/UI/client code, the normal dispatcher/store, public shared schemas, frozen `web/src/server/ai-evaluation/cases.ts`, `shared/fixtures/**`, dependencies/lockfiles, CI, transcription, services, MeltingPot or other milestones. Prefer the existing transport facilities; return to Codex with a concrete reason and affected paths if an SDK/dependency or wider contract change is necessary. Do not weaken a check just because the new provider cannot satisfy it.

## Implementation order

1. Read `AGENTS.md`, the handoff, this contract, ADRs 0003/0009/0010/0012, the frozen evaluation record and the existing adapter/ledger. Reuse the safeguards already implemented; do not rebuild unrelated code.
2. Verify **current official Google documentation** for the Gemini API endpoint, exact model ID, structured-output support, model/request limits, usage fields, pricing and relevant account-tier data retention/training terms. Target the direct Gemini API; do not introduce Vertex/cloud infrastructure without a scoped decision. Prefer an explicit stable model version where available, otherwise disclose alias/version drift. Select routine settings yourself from verified facts; escalate material limitations to Codex.
3. Before coding the provider-specific pieces, record the chosen model/settings, dated primary-source links, maximum billable token bounds and reservation calculation in ADR 0012 and the runbook. These values must describe the actual request. Keep the proposed cap at or below **$1 total / 32 attempts**, one active request. Include all billable token categories, such as reasoning/thinking or cached input if applicable. A token-counting endpoint is also a provider call and is not authorized during preparation. If a defensible bound cannot fit the proposal, report it rather than lowering the reservation or raising the cap silently.
4. Adapt request/response serialization, runtime validation, provider identity, usage accounting and process credential handling. Use `GEMINI_API_KEY` only in the backend trial process. Keep keys out of URLs, prompts, logs, error bodies, saved reports and client bundles. Update active setup instructions so no OpenAI credential or endpoint is required. Never search for, copy, print or test existing keys during this task.
5. Preserve end-to-end cancellation, byte/token bounds, one active attempt, no automatic network/JSON-repair retries, durable pre-send reservation, uncertain-charge retention and late-refund rejection. Preserve source/policy validation and immutable reports across interruptions. Check for existing accounting state without revealing secrets; do not remove locks or reset budgets. Explain an incompatible historical ledger and require deliberate reviewed handling instead of creating a fresh allowance silently.
6. Preserve separate generation and verification calls, fixed synthetic cases, oracle isolation, citation grounding, refusal handling, and the actual extension/client/dispatcher path. Use native Gemini schema/settings only after verifying their semantics; OpenAI's `store:false`, response wrapper and usage fields are not portable assumptions. Keep the total **10-second Help / 4-second practice** limits, including verification and the existing single stale-snapshot retry. Keep the two paid probes on real-clock 1× playback; injected offline clocks must remain labelled separately.
7. Add focused injected tests for the new provider behavior and preserve the existing protections: malformed/refused/incomplete/oversized output, schema/identity/usage mismatch, timeout/body-read cancellation, literal and encoded credential echoes, interrupted accounting, cap/restart behavior, independent rejection and instruction-like transcript content. Verify every default path stays offline. No real provider traffic, free-tier checks, or hidden retry is allowed.

## Completion checks and handoff

Run the project's Node 24 / npm 11.9.0 checks appropriate to these changes, then `npm run check`. That final command uses a temporary production server on port 3000; first check that it is free. If an existing service occupies it, preserve that service, run the nonconflicting checks and use CI for the required production check. Do not report a skipped command as passed. Also run the separate component journey:

```text
npm run ai:trial
npm run test:ai-readiness
npm run test:meltingpot -- --meltingpot-root=C:\Users\abuiz\Documents\Codex\2026-09-04\MeltingPot-rework
```

`ai:trial` without execution flags must print the **Gemini** plan offline. The MeltingPot check uses the isolated copy and no network; it must not mutate that repository or start its services. Do not rerun the same passing checks repeatedly without a new change or concern. A previous 303-test total is historical evidence, not a target count to preserve by deleting tests.

Inspect the final diff, commit scoped work on the shared branch, and leave **IN REVIEW** with the exact source hash, selected model, cited pricing/privacy facts, commands and actual results, changed files, any skipped checks and one next step. Set Active AI to none. Independent exact-source review and green required CI precede any promotion or request to execute the paid trial. Do not self-merge or mark real AI quality PASS.

Return to Codex for any material change to grounding, deadlines, cost bounds, public contracts, scope or architecture. If credentials, spend approval or human evidence are absent, complete all independent offline work and leave that precise pending step; do not start unrelated future features to bypass it.
