# TASK-201 — Complete the Local Learning Demo

**Tier:** 1
**State:** MERGED when the independently approved integration transaction reaches main; IN REVIEW until then
**Coordinator:** Codex Coordinator
**Exact base:** `426bfda6f14172b3d5b3c9bd1c3cf2104ed6861f`
**Integration branch:** `coord/TASK-201-learning-demo`
**Timebox:** One working implementation session; checkpoint if an external prerequisite prevents completion.

## Execution Authorization

After the milestone explanation, the Product Owner instructed **“Execute.”** This authorizes construction and automated verification of this local, synthetic learning demo now, without waiting for the administrative calendar fields. It does not invent dates, authorize provider spending, waive human acceptance, or select a scripted final submission. The Product Owner separately prohibited control of laptop apps, browsers, mouse, and keyboard without session-specific permission. Use files, command-line builds, and noninteractive tests only; do not open or automate a browser/UI.

## Frozen Contracts

The existing shared session, transcript, assistance, confusion, practice, and API schemas at the exact base are retained. No lane may change `shared/**`.

- Backend: `http://127.0.0.1:3000`, enabled only by `LIVELECTURE_DEMO_ENABLED=true`; optional exact extension ID from `LIVELECTURE_EXTENSION_ID`.
- Every learning API request carries `X-LiveLecture-Demo: scripted-v1`. This is a nonsecret browser-preflight guard, not authentication.
- Use all six existing `ApiContracts` routes and envelopes. Add only `DELETE /api/sessions/:sessionId`, responding with `{ ok: true, data: { deleted: boolean } }` or the existing error envelope.
- Session IDs come from the server; remap each fixture chunk's session ID without changing its immutable chunk identity/content/timing. The server accepts only exact canonical synthetic fixture chunks.
- End time is `serverSession.startedAt + latest committed passage endMs` (zero before the first passage), not a partial passage or elapsed wall time during accelerated replay. The server validates it through the existing store.
- Session handoff remains the validated path `/sessions/:sessionId`, joined to the fixed loopback origin. No tokens, transcript, or other data enter that URL.
- Help flushes visible committed chunks before requesting a server-owned snapshot. Never weaken ADR 0003. Stale results fail visibly and safely.
- Arrivals during a scripted help request remain queued until the next operation. This keeps the deterministic callback consistent; it does not satisfy TASK-103's separate test of actual AI with continued ingestion and bounded response time.
- Two prewritten cases: recognizing inner/outer functions and including the inner derivative. A separate verifier must reject changed/unsupported scripted outputs and evidence.
- Persistent UI disclosures distinguish **SIMULATION transcript** from **PREWRITTEN DEMO HELP — no AI provider used**.

## Assigned Lanes and Exclusive Ownership

- TASK-202 / `m2_backend`: `web/src/server/**`, `web/src/app/api/sessions/**`. Includes tests in those paths. Branch `task/TASK-202-local-learning-service` in its own worktree.
- TASK-203 / `m2_extension`: `extension/src/App.tsx`, `extension/src/demo-*.ts`, `extension/src/styles.css`, `extension/test/**`, `extension/public/manifest.json`, `scripts/verify-extension-package.mjs`. Branch `task/TASK-203-lecture-help` in its own worktree.
- TASK-204 / Codex Coordinator: companion UI under `web/src/app/sessions/**`, `web/src/app/demo/**`, `web/src/components/**`, `web/src/lib/client/**`, home/styles, web config and package scripts, root package/lockfile if needed, `scripts/demo-*.mjs`, README, `.env.example`, and coordinator docs/board. No overlapping agent edits.

The Coordinator's integration branch contains only reviewed/cherry-picked agent commits plus its own isolated lane. Root manifests/configuration and coordination records have a single writer. Existing optional live tasks remain unassigned and do not own these files during this task.

## Acceptance and Review

- Extension (and a browser rehearsal view reusing the same lecture component) connects to the real local HTTP API, replays the fixture, displays help, and resolves citations to actual visible chunks.
- Fresh sessions, ordered uploads, duplicate-safe behavior, reset/deletion, unavailable server, insufficient evidence, and cancelled/stale requests have meaningful automated coverage.
- End/session handoff preserves the logged confusion; the companion selects real stored events and serves correct, distinct practice for both concepts with an attempt and answer explanation.
- Loopback/origin/header/body/rate/lifetime restrictions and no-store responses are tested. No provider calls, real classroom data, recordings, or durable lecture storage.
- An automated test exercises the complete deterministic callback; it runs under `npm run check`.
- Run the full repository check, inspect the exact diff, obtain independent Tier-1 review, and use a temporary independent integrator for Coordinator-authored changes.
- Actual AI quality, unpacked-Chrome/manual UI verification, an uncoached learner demonstration, and final judge-route acceptance remain separately PENDING. Do not label the whole milestone ready from automated checks alone.

## Implementation Handoff

The candidate implementation is `e78852dd61be569a1120bd9a71d70b9e7986f0df`. The source-lane reviews, integration condition, and separate M2 readiness areas are recorded in `docs/TASK_BOARD.md`. `npm run check` includes both the real component/API callback and the production HTTP walkthrough; `npm run dev:demo` starts the private demo without opening a browser. Temporary integrator `m2_integrator` must use the exact final approved commit and a successful full check. No shared schema, provider choice, audio capability, permanent key, or durable lecture storage was introduced.
