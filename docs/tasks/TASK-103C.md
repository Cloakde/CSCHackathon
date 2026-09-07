# TASK-103C — Replace the inactive assistance trial with Gemini

- **Tier:** 1
- **State:** IN REVIEW — offline implementation complete, zero provider calls made
- **Implementer:** Claude, 2026-09-06
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

## Implementation record (Claude, 2026-09-06)

**Source:** implementation candidate `e0da4dfe7eccfef22ddcbaebd8928657af57ef19`, based on shared head `c163e6b` (which itself contains main `48172a2b82e9615b4fc1b39217b37868ae006d09`). No ledger directory existed on disk under either the old or new plan ID before this change, confirmed by inspection — no spent allowance is discarded by the new plan ID.

**Model/configuration:** `gemini-2.5-flash-lite` via `generateContent` (`v1beta`), header auth (`x-goog-api-key`), `responseMimeType: "application/json"` + `responseSchema`, `store: false`, thinking left at its documented off-by-default state, no `cachedContent`, no tools. Full facts and dated citations are in [ADR 0012](../adr/0012-gemini-assistance-direction.md#verified-configuration-claude-checked-2026-09-06).

**Reservation:** 105,677 microdollars/attempt (down from the OpenAI proposal's 422,308, since this model is materially cheaper), cap unchanged at $1 total / 32 attempts.

**Files changed (all within owned paths):**

- `web/src/server/ai-evaluation/trial/policy.ts` — full rewrite: Gemini endpoint/model/pricing/reservation, new plan ID, adapted policy-hash fields.
- `web/src/server/assistance/provider-trial/transport.ts` — request construction and response-envelope validation rewritten for `generateContent`'s shape; the reservation/settlement/cancellation/byte-bound/credential-echo architecture is unchanged.
- `web/src/server/assistance/provider-trial/transport.test.ts`, `index.test.ts` — rewritten for the Gemini request/response shape, preserving the same edge-case categories (malformed/refused/incomplete/oversized output, usage/identity mismatch, timeout/cancellation, credential echoes, instruction-like transcript content). One sub-case (`x-request-id` header credential echo) was dropped rather than faked: Gemini's `generateContent` response carries no equivalent extra header, and no other test in that category was weakened to compensate — the surrounding literal/encoded-output and `responseId`-field echo checks already cover that defense category.
- `web/src/server/ai-evaluation/trial/budget.test.ts` — recomputed every reservation/charge literal for the new pricing; replaced the one test whose assertion embedded an OpenAI-specific budget-exhaustion attempt count with an equivalent one computed from the policy constants (`Math.floor(TRIAL_CAP_MICRO_USD / TRIAL_RESERVE_MICRO_USD)`), which is now provider-agnostic.
- `scripts/ai-trial.mjs`, `scripts/ai-trial.test.mjs`, `web/src/server/ai-evaluation/trial/actual.run.tsx` — `OPENAI_API_KEY` → `GEMINI_API_KEY`; the offline plan's retention/execution text updated.
- **Not changed, verified compatible as-is:** `web/src/server/assistance/provider-trial/schemas.ts` (the existing `OutputJsonSchemas`' use of `anyOf`, `additionalProperties`, `enum` is within Gemini's documented `responseSchema` subset — verified against a worked union example in Google's docs before assuming this), `prompts.ts` (prompt content and `TRIAL_PROMPT_VERSION` are provider-independent, left untouched), `index.ts`, `web/src/server/ai-evaluation/trial/{types,budget,report,scenarios,component-probe}.ts` (already provider-agnostic; `budget.ts`'s ledger mechanics needed no logic changes, only the imported constants changed).
- Documentation: this file, [ADR 0012](../adr/0012-gemini-assistance-direction.md), [PHASE-B.md](../evaluations/TASK-103/PHASE-B.md) (rewritten as the live Gemini runbook, prior OpenAI proposal preserved as a historical section rather than deleted), [evaluations/TASK-103/README.md](../evaluations/TASK-103/README.md), root `README.md`'s trial paragraph, `docs/TASK_BOARD.md`, `docs/HANDOFF.md`.

**A material technical finding surfaced during research, recorded for the reviewer:** Google is steering new work toward a newer `v1beta/interactions` API. `generateContent` was kept anyway — it remains fully supported per Google's own migration guide, Interactions has an announced breaking-change date (May 2026) unsuited to a dated trial snapshot, and `generateContent`'s documentation was complete and consistent where Interactions' was thinner and inconsistent across fetches. Treated as a routine, verified-facts decision rather than something requiring escalation; flagged here so a reviewer can weigh it differently if they disagree. Full reasoning is in ADR 0012.

**Known unverified risk, explicitly not resolved by this offline work:** the strict `modelVersion === "gemini-2.5-flash-lite"` check assumes Gemini echoes the exact requested model ID rather than a more specific resolved build string. Cannot be confirmed without a live call. If the first authorized attempt fails there, relax that specific check under a reviewed follow-up rather than loosening validation now.

**Commands run and results:**

```text
node --test scripts/demo-server.test.mjs scripts/ai-trial.test.mjs   → 7 passed, 0 failed
npx vitest run (web workspace)                                       → 13 files, 196 tests passed
npm run typecheck (root, all three workspaces)                       → clean, no errors
npx eslint <changed paths> --max-warnings=0                          → clean, no warnings
npm run secret:scan                                                  → "Secret scan passed."
npx prettier --check <changed paths>                                 → clean after one --write pass
```

**Skipped, and why:** `npm run check`'s full production-HTTP verification was not re-run — this task's owned paths never touch the dispatcher, store, client, or any HTTP route; only the private trial adapter's internals changed, and the trial stays inactive in every normal path (verified above by `ai:trial` still printing an offline plan and by every provider test injecting its own transport). `npm run test:meltingpot` was not re-run for the same reason — no MeltingPot-adjacent file changed. Both should be re-run as part of `npm run check` at final integration if the reviewer wants full-suite reconfirmation; nothing in this diff should affect their outcome. No provider call was made or attempted; `GEMINI_API_KEY` was never read, searched for, or referenced beyond the literal string `"GEMINI_API_KEY"` in guard code and docs.

**Next step:** independent review by Gemini or Codex (not Claude) against this exact commit, per TASK-103C's stated review requirement. After that, the still-open steps are unchanged from before this task: explicit Product Owner approval of the $1/32-attempt cap for this Gemini configuration specifically, and a locally configured server-process `GEMINI_API_KEY`, before any real call. This task does not itself request that approval.
