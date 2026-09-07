# TASK-304 — Gemini's offline review and connected-journey hardening queue

- **State:** READY for Gemini when the user hands it the turn; implementation has not started.
- **Tier:** 1 for changes to cancellation, grounding, privacy or deletion; existing behavior and contract protections remain mandatory.
- **Assigned engineer:** Gemini, working sequentially on `shared/livelecture` in the primary CSCHackathon checkout.
- **Senior lead and independent reviewer of Gemini-authored fixes:** Codex on a later turn. Gemini can independently review Claude's unchanged implementation, but cannot approve its own corrections.
- **Planning checkpoint:** `fe6f1a9bedcd73832c30e0eb1d335929b750edd7`. Start from the current shared head containing this plan, inspect intervening changes and record the actual hash. Never reset to the planning checkpoint.
- **Milestone relationship:** TASK-103C review followed by bounded M3 resilience work and offline preparation for later checks. This does not mark M3 complete or unlock M4 feature implementation.
- **Timebox:** Complete reviewable steps across the user's Gemini sessions. Checkpoint at each substantive step; do not invent calendar dates or promise to finish human/provider gates in this queue.

## Direction and boundaries

The user requested a substantial next-work sequence for Gemini and explicitly said **we are not testing with the API yet**. This queue replaces the old immediate progression from migration review to actual-model testing. Real provider testing is deliberately DEFERRED, not a reason to stop unrelated offline work or repeatedly ask the user for a key or spending permission.

The existing product path is a Chrome extension during class and private lecture practice in the separate MeltingPot rework afterward. Keep the prototype companion as a regression fallback. Strengthen this implemented journey before adding breadth. Use synthetic transcripts, prewritten assistance and injected test responses; none establishes actual AI quality or live transcription.

No real Gemini, OpenAI, ElevenLabs or other provider request is permitted, including free-tier, token-count, credential-validation and connectivity requests. Do not find, read, configure or test credentials. Do not activate the provider in the normal app. Reading official public documentation is permitted; local synthetic service/component tests are permitted and do not authorize external provider traffic.

Synthetic sentinel strings are allowed in injected credential-leak tests; never substitute an existing real key.

Only `main` and `shared/livelecture` may exist as working branches. Use the primary folder; preserve dirty files, old detached folders and recovery archives. No additional branch, worktree or concurrent AI. No self-merge or promotion to main during this queue. The user starts Gemini's turn; this assignment does not launch it automatically.

No native/browser automation, extension installation, screenshots, recordings or human acceptance claims without the user's separate session permission. Do not stop or replace an existing preview, broaden network access, deploy, publish or submit. No live audio, storage/authentication changes, dependency changes, shared wire-schema changes or unrelated redesign.

Neither original MeltingPot repository nor its accounts/services is in scope. The isolated `C:\Users\abuiz\Documents\Codex\2026-09-04\MeltingPot-rework` copy is **read-only for this queue**, except unavoidable test-runner temporary files: inspect the relevant private-lecture components and use the existing guarded component test. Record its actual revision and preserve tracked/unfinished files. Do not run its normal app, start its services, change its branch/remotes or copy it into LiveLecture. A fix required in that repository gets a concrete proposed patch scope for Codex; continue independent work here.

## How to work through the queue

Finish the steps in order when their dependencies allow it. For each step, inspect existing code and tests first. Record the useful evidence and move on if the requirement is already satisfied. Add code or tests only for a demonstrated bug or a meaningful untested behavior; no duplicate tests, cosmetic churn or large refactors to fill the session.

Before each change, record the step, starting hash, observed failure, expected behavior and specific owned files in the handoff. Use small checkpoints with actual checks. If one step needs a scope decision or human evidence, mark only that part pending and continue a later independent step. Do not weaken a contract to make tests pass. Preserve failed-check evidence even after fixing the failure.

### 1. Take over the correct work

Read `AGENTS.md`, `HANDOFF.md`, `AI_ASSIGNMENTS.md`, this contract and the relevant TASK-103C/ADR records. Verify the branch, latest commit, dirty files and current turn. Record the exact implementation under review: Claude's `e0da4dfe7eccfef22ddcbaebd8928657af57ef19`, plus any later implementation changes discovered on the shared branch.

**Done when:** the handoff identifies Gemini, the current source, this queue and the first scoped step. Existing work is preserved; no historical worktree is resumed.

### 2. Independently review Claude's Gemini migration

Review TASK-103C against its contract, not just Claude's summary. Check request/schema compatibility, response/model identity, credential leakage, cancellation, bounds, reservations, restart accounting and default-offline behavior. Consult current official Google documentation for disputed API details without calling a provider. In particular, independently check the documented request fields/schema subset and the strict `modelVersion` assumption; do not treat either the prior handoff or a mocked response as provider evidence. Do not automatically relax identity validation or change endpoints to address an unverified assumption.

Reproduce the required offline checks that Claude skipped as part of the verification plan below. Record `APPROVED` for the exact unchanged source only if its review/check requirements are met, otherwise specific `CHANGES REQUESTED` or a precise pending verification. Keep live compatibility and real-AI quality unverified.

**Done when:** a review record lists exact source, findings, checked documentation, actual test results and remaining uncertainties. Paid verification is not requested.

### 3. Correct bounded migration defects, if found

Gemini may implement demonstrated corrections within TASK-103C's existing owned paths and unchanged safeguards. Keep these fixes separate from the review of Claude's original commit. Do not change the selected provider, spending caps, trust rules, frozen oracle/cases or app activation policy to make migration appear ready. Material provider-surface/configuration tradeoffs return to Codex with evidence.

**Done when:** necessary fixes have focused regression evidence and separate commits marked IN REVIEW for Codex. If no correction is needed, record that and continue. This inactive trial does not block independent scripted-journey work while its review is pending.

### 4. Establish the connected sample-lecture baseline

Exercise the actual extension component, local learning service and existing private MeltingPot component test using two distinct confusion concepts. Map the existing coverage for transcript → “I'm Lost” → Finish → private practice → feedback → citation return → deletion. Record exact LiveLecture and rework-copy revisions. Preserve both the packaged extension's MeltingPot destination and the explicit prototype fallback; never silently substitute the old companion.

**Done when:** one compact evidence matrix distinguishes passing behavior, reproduced defects, meaningful coverage gaps and manual-only checks. Existing tests are reused; no second imitation demo is built.

### 5. Strengthen lecture controls and recovery

Use injected failures and delayed responses to check continued transcript delivery while Help is pending, ordered retry after upload failure, safe repeated Finish, Stop replay, reset and abandoned requests. Stop pauses simulation; Finish completes the session, and reset discards the sample state under the existing contract. Do not silently redefine those controls. Verify that reset/deletion cannot be undone by late work and that unavailable services give a clear retry/reopen path.

**Done when:** confirmed defects have bounded fixes and regressions; pending work cannot restore a previous lecture or duplicate committed passages. Already-covered behavior is referenced, not reimplemented. Real Chrome panel/service-worker lifecycle checks remain pending where component tests cannot establish them.

### 6. Protect the confusion-to-practice link

Check that each of two selected confusion moments produces practice for its own concept and evidence, feedback corresponds to that exercise, and citation return resolves to the correct lecture passage. Exercise wrong-session, wrong-concept, missing citation, switched-topic, cached/late-response and deleted-session cases. Preserve the learner's current answer when visiting and returning from a citation. Check unsupported or instruction-like lecture text fails safely under existing grounding rules.

**Done when:** targeted practice and source linkage have observable coverage across the real connected component path. Do not claim general mathematical quality from the fixture, rewrite the frozen evaluation cases, or allow tests to expose oracle answers to generators/verifiers. Rework-copy defects become scoped findings for Codex, not edits outside this repository.

### 7. Check private data and safe failure behavior

Inspect the existing local-only boundaries and run relevant hostile-input tests: wrong origin/session, malformed/oversized data, redirects, cancellation, deletion and replay of stale results. Confirm private lecture/answer data cannot enter inherited shared Pot, teacher-report, account or provider flows in the tested rework mode. Check safe fixed error messages and the absence of secrets/raw lecture payloads in diagnostics.

**Done when:** local boundary findings are fixed within the allowed scope and each claim points to evidence. Read-only inspection/component tests of the rework copy do not establish production authentication, human privacy acceptance or real provider retention. No new storage, sharing, permissions or endpoints are introduced.

### 8. Improve the existing extension's usability

Fix meaningful problems found in the current controls: misleading labels, unclear loading/error states, disabled controls without an explanation, keyboard/focus traps, missing accessible names or unreadable narrow-panel layout rules. Keep Simulation and prewritten-help disclosures separate and visible. Use existing styling and component facilities; keep “I'm Lost,” Finish and the next practice action easy to understand.

**Done when:** actual usability defects have focused changes with component/keyboard coverage where practical. Avoid a visual redesign. Static/component checks cannot prove actual Chrome layout, contrast rendering, screen-reader behavior or uncoached usability; put those items in the later manual card.

### 9. Prepare a reproducible extension package

Build the real extension through existing commands and inspect the existing package verifier, manifest, bundled assets and destination configuration. Verify the package retains the intended side panel and local-only connections, contains no provider credential path/remote executable code and uses the correct private practice link. Improve the verifier only for a concrete missing check or defect; do not change permissions or the manifest as part of this step.

**Done when:** the build/package checks pass and the handoff records source hash, generated package location and file checksums. Keep generated output in existing ignored build folders. Packaging does not count as Chrome installation or permission-flow verification.

### 10. Run final offline integration checks

After substantive changes, run the complete applicable verification against the final source plus the separate guarded MeltingPot component journey. Use the commands below. The HTTP smoke can start its own temporary LiveLecture server only when the port/build output is safe to use; never stop, reuse or overwrite another running preview to force a PASS. Identify and stop only a temporary server that this verification itself started.

**Done when:** the exact candidate's check results and source identities are recorded. Failed or skipped commands stay explicit. Do not rerun passing checks without a new change, failure or unresolved concern. Current component evidence does not refresh an older paired production-HTTP result for the rework app; keep that separate check pending.

### 11. Prepare an easy manual test and demo guide

Write a short cold-start guide and a task card for a person who did not build the app: install/open the extension, start a sample lecture, request help at two different concepts, finish, try both exercises, inspect feedback, follow a citation, return and delete the session. Include unavailable-service recovery and clear Simulation/prewritten-help disclosures. Identify expected outcomes without coaching the learner through the acceptance run.

**Done when:** the guide uses verified commands/paths and clearly lists unperformed checks: actual Chrome appearance/lifecycle, uncoached learner/content review, the selected judge route and provider evidence. Prepare materials only; do not use the laptop, book dates, record a demo, choose a submission route or claim release readiness.

### 12. Prepare the next feature decision and hand off

Read the M4 priorities and inspect suitable study components in the isolated copy without modifying them. Write a brief reuse assessment and one proposed bounded next task, prioritizing grounded Ask, followed by Catch Me Up/Explain This as the current milestone plan specifies. Include the user benefit, reusable source paths, required provider/grounding behavior, proposed owned files and acceptance checks. This is a design proposal, not permission to build M4 or migrate MeltingPot wholesale.

**Done when:** the final handoff lists completed steps, precise commits/checks, pending reviews and the smallest next decision. All Gemini-authored fixes remain IN REVIEW for Codex; actual API testing remains DEFERRED. Release the active turn. Do not fill remaining time with extra features, another branch or broader redesign.

## File ownership for Gemini

This is Codex's bounded amendment to the older concurrent task contracts. Ownership is sequential; record the narrower files used for each step. Read access to relevant project code is permitted, but write access is limited to:

- **Steps 2–3:** TASK-103C's existing owned paths only, including its review/evaluation records. Preserve all its forbidden paths and immutable evaluation inputs.
- **Steps 4–8:** `extension/src/App.tsx`, `extension/src/styles.css`, `extension/src/demo-api.ts`, `extension/src/demo-uploader.ts`, `extension/src/demo-handoff.ts`, and corresponding `extension/test/**`; `web/src/server/demo-api.ts`, `web/src/server/demo-api.test.ts`, `web/src/server/assistance/operation.ts` and its focused adjacent test if needed; `web/src/components/SessionReview.tsx`, `web/src/components/SessionReview.module.css`, `web/src/components/learning-demo.test.tsx`, `web/src/components/help-ingestion.test.tsx`, `web/src/lib/client/study-client.ts` and its focused adjacent test if needed; `scripts/meltingpot-connection.test.tsx` for connected component coverage. Preserve existing service/grounding/handoff contracts.
- **Steps 9–10:** `scripts/verify-extension-package.mjs` and an adjacent focused test if needed; `scripts/demo-server.mjs`, `scripts/demo-server.test.mjs`, `scripts/demo-smoke.mjs` only for demonstrated safe-launch/verification defects. Existing test/build commands may be run; no new CI/dependency/configuration scope is granted.
- **Evidence and guides:** this contract; `docs/evaluations/TASK-304/**`; a new `docs/GEMINI_OFFLINE_REVIEW.md` for TASK-103C review findings; the relevant handoff/task-board status; narrow setup/demo instructions in `README.md`. Step 12 proposals belong in the TASK-304 evidence directory and do not amend the accepted architecture by themselves.

Do not edit `shared/**`, frozen `web/src/server/ai-evaluation/cases.ts`, public API route contracts, extension manifest/background behavior, dependencies/lockfiles, CI, provider defaults outside TASK-103C, another repository, or unrelated screens. If a demonstrated defect requires those paths, give Codex the failure, proposed correction and exact affected files; continue independent in-scope work. Do not work around missing ownership by weakening a caller's validation.

## Verification and evidence

Use the repository's existing Node/npm requirements and installed tooling. Relevant commands, with real results rather than a promised test count:

```text
npm run ai:trial
npm run test:ai-readiness
npm run check
npm run test:meltingpot -- --meltingpot-root=C:\Users\abuiz\Documents\Codex\2026-09-04\MeltingPot-rework
git diff --check
```

`ai:trial` here means **no arguments**: it only prints the offline plan. No execution/approval flag is permitted. Ordinary tests must use injected providers. Use focused existing workspace test commands during a fix; use the full check at the appropriate review/final checkpoint. If an earlier full check already covers unchanged sources, reference it rather than repeating it merely because another queue step was reached.

Before builds or the HTTP smoke, check for existing development/production processes using the same output folders and ports. Preserve them. If there is a conflict, run the nonconflicting checks, record the exact omission and continue independent work; do not remove build files or kill the user's process. The paired component command uses the isolated copy through its existing guarded test launcher and must not execute inherited external services. Do not create a new clone/worktree for a clean-install test under this assignment.

Keep one compact progress/evidence record in `docs/evaluations/TASK-304/README.md`: step, observed issue or existing coverage, changed files, exact commit(s), commands/results and remaining limits. Separate offline synthetic success from provider, browser, human, judge and release acceptance. Include the isolated copy's exact hash for paired evidence. Preserve historical results; do not rewrite them to make the latest candidate appear checked.

No API test is the next automatic action after this queue. Gemini hands off its completed offline work to Codex; API testing waits until the user deliberately resumes it in a later instruction.
