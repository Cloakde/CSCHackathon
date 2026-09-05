# TASK-301–303 — Private Lecture Review and MeltingPot Connection

**Tier:** 1

**State:** IN PROGRESS; independent contract approval recorded at `5427e097ec73234e886f63049189cf136fcc7378` by `m3_review`

**Coordinator:** Codex Coordinator

**LiveLecture base:** `2d8a9adf44f782d93e4d84b9838411025f63ad09`

**MeltingPot rework base:** `89a15ffa95aa227648a3aac81382eed558ebfa81`

**Independent reviewer:** `m3_review`

**Temporary independent integrator:** assigned before merging any Coordinator-authored revision

**Timebox:** One implementation/review session; checkpoint with evidence if a required external check cannot run

## Authorization and Scope

The Product Owner instructed **“Execute the next milestones.”** This authorizes the planned synthetic M3 implementation and automated verification now, without waiting for administrative calendar dates. M4 remains gated on the connected journey and required human/AI/judge evidence; do not claim those checks from automation or bypass the gate by adding broader features.

This request does not authorize provider spending, credentials, real classroom data, audio capture, changes to either original MeltingPot repository or its live services, a new MeltingPot remote, deployment, or laptop/browser control. Use isolated worktrees and preserve the existing local demo.

## Frozen Design

[ADR 0008](../adr/0008-local-meltingpot-handoff.md) defines the complete local handoff/access contract and observable failure behavior. Existing ADR 0002/0003/0006 invariants and shared wire schemas remain unchanged. The source-of-truth schema files are pinned from the LiveLecture base and copied without edits into a small local package consumed by MeltingPot.

## Exclusive Ownership

**TASK-301 / `m3_meltingpot`**, branch `task/TASK-301-private-lecture-review`, isolated `MeltingPot-m3` worktree:

- `web/app/lectures/**`, `web/app/api/lectures/**`
- `web/components/lectures/**`, `web/lib/lectures/**`, including UI, relay, guards, and tests
- `web/proxy.ts`, `web/next.config.ts` for the isolated mode only
- `web/vitest.rework.config.ts` and `web/test/rework-offline-setup.ts` for the new meaningful tests

**TASK-302 / `m3_extension`**, its own LiveLecture task branch/worktree from the reviewed contract revision:

- `extension/src/App.tsx`, `extension/src/main.tsx`, new `extension/src/demo-handoff.ts`
- `extension/test/**` for handoff, recovery, and preserved prototype tests

**TASK-303 / Codex Coordinator**, LiveLecture branch `coord/TASK-303-meltingpot-integration` and nonoverlapping paths in the MeltingPot task worktree:

- LiveLecture: `docs/TASK_BOARD.md`, this contract, ADR 0008, `README.md`, `package.json`, `.github/workflows/ci.yml` only if needed for verification, `scripts/meltingpot-*` (including the dedicated test/configuration), and `web/src/app/demo/meltingpot/**`.
- MeltingPot: `AGENTS.md`, `.gitattributes` for canonical vendor line endings, `REWORK.md`, `docs/LIVELECTURE_HANDOFF.md`, `vendor/livelecture-contracts/**`, `web/package.json`, `web/pnpm-lock.yaml`, `scripts/rework-*.mjs`, and `scripts/verify-livelecture-*.mjs`.

All other paths are forbidden without a Coordinator amendment. In particular, no original MeltingPot checkout, shared LiveLecture schema/store/grounding files, backend API, production migration, old provider selection, or unrelated screen is owned. Reviewers are read-only. Each lane commits only its owned files; the Coordinator alone cherry-picks reviewed LiveLecture lane commits. The independent integrator promotes final approved revisions.

Coordinator amendment: `m3_extension` additionally owns only `scripts/rework-environment.test.mjs` in the MeltingPot task worktree for offline launcher/fingerprint regression coverage, and `scripts/meltingpot-http.mjs` in the LiveLecture integration worktree for the bounded paired HTTP check. These are separate from its extension lane; it may commit only its explicit paths in each worktree.

## Acceptance and Verification

Coordinator amendment after production build and review: the Coordinator owns the narrow MeltingPot `web/next.config.ts` package-transpilation correction for the vendored TypeScript contract dependency and `web/lib/lectures/relay.ts` plus its existing test for sharing the production request quota across Next route bundles. No other configuration or feature ownership changes; final exact review includes these corrections.

- The actual extension component finishes the sample lecture and exposes the canonical MeltingPot URL for the same completed session. Repeated Finish is safe; explicit prototype destination still works. An unavailable destination leaves a reopening link.
- The actual private MeltingPot component loads that completed synthetic session, displays its confusing topics, produces different practice for two concepts, lets the learner attempt and inspect feedback, and focuses/returns from the correct evidence without losing the attempt.
- Relay/runtime-schema checks reject wrong session, concept, event, evidence, active/missing/deleted/expired data, malformed or oversized responses, bad Host/Origin/header/path/method/body, redirects, stalled incoming bodies, and timeout. Only the fixed upstream is called; no credentials are forwarded.
- Rework mode prevents inherited authentication, model, class, database, and admin execution, including suffix/encoded path variants. Tests assert zero inherited-service calls. No private data enters shared Pot or teacher flows.
- Cancellation/version tests cover delayed reads/practice after topic/session changes or deletion. Errors are visible and retryable where appropriate; stale content is cleared.
- Keep all existing M2 tests and production smoke green. Run the guarded MeltingPot lint/type/unit/build checks with its database suite excluded and network calls mocked.
- Run a paired component/API callback and production HTTP smoke with exact source revisions and schema hashes recorded. If reusing the user's current LiveLecture backend, validate source parity and record its actual server revision as required by ADR 0008. Only test-owned synthetic sessions may be deleted.
- No browser is opened or automated. Human Chrome, uncoached learner/content, actual AI quality, and judge-access checks are recorded as PENDING; engineering MERGED is not full M3 PASS.
- Obtain independent exact-commit review and green relevant checks for both repositories. The original MeltingPot remotes remain absent/blocked. Do not self-merge Coordinator-authored changes.

## Handoff

Record exact bases and final commits, changed paths, commands and results, tests not run, paired-source/schema parity, manual acceptance status, launcher instructions, transient data behavior, known limitations, and the explicit prototype fallback. Keep the current M2 service alive; no automatic switch to an old companion is allowed.
