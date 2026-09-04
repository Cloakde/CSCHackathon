# LiveLecture AI

LiveLecture AI is an in-class learning assistant designed around one continuous loop:

> lecture → confusion → grounded help → continued learning → targeted practice afterward

The Chrome extension will eventually capture a user-selected browser tab, stream a realtime transcript, and help a student recover when they fall behind. The companion Next.js app will turn each recorded confusion event into focused post-class practice.

## Current state

This repository is at the **canonical bootstrap** milestone. It currently includes:

- A buildable Manifest V3 side-panel extension shell.
- A buildable Next.js companion shell.
- Zod-first transcript, session, assistance, citation, confusion, and study contracts.
- A server-derived, revision-bound grounding snapshot and atomic assistance-response/confusion-event store boundary.
- Server-owned citation hydration, a fixed safe insufficient-evidence response, and a fail-closed independent semantic evidence-verification boundary.
- A deterministic eight-minute synthetic calculus lecture fixture.
- A visibly labeled Simulation Mode with Start, Pause, speed, Stop, reset, partial text, and committed transcript chunks.
- Real format, lint, local secret-scan, typecheck, test, and build commands, plus full-history Gitleaks scanning in CI.

It does **not** currently record audio, call ElevenLabs, call a generation model, or persist classroom data. Those capabilities must pass later isolated tasks and cannot silently replace Simulation Mode.

## Requirements

- Node.js 24; the same release line is used in CI.
- npm 11.9.0 (declared in `packageManager`).
- Chrome 116 or newer for the eventual offscreen tab-capture architecture.

## Install and verify

```bash
npm ci
npm run check
```

The first local install uses `npm install` only when intentionally updating `package-lock.json`. CI and clean verification use `npm ci`.

## Run the companion app

```bash
npm run dev:web
```

Open `http://localhost:3000`. The page describes the current synthetic baseline without claiming that live providers are enabled.

## Build and load the extension

```bash
npm run build --workspace=@livelecture/extension
```

Then open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select `extension/dist`. Click the extension action to open its side panel.

The side panel currently replays synthetic fixture data. Its persistent **SIMULATION** banner must remain visible whenever this source is active.

## Repository map

```text
extension/  Chrome MV3 side-panel shell and Simulation transcript UI
shared/     Runtime schemas, deterministic fixture, source adapter, and store boundary
web/        Next.js companion shell and server-side API home
docs/       Workflow, milestone plan, task contracts, and architecture decisions
```

## Environment and secrets

Copy `.env.example` only when a later approved provider task requires it. Permanent provider credentials are server-only and must never use a `NEXT_PUBLIC_` prefix, enter extension bundles, appear in URLs, or be committed.

Never use real classroom recordings or student data in automated tests. The canonical fixture is synthetic.

Grounded-assistance callers must use the public verified build-and-record transaction with a server-derived grounding snapshot. They may not accept client-authored anchors, model-authored citation timing, or model-authored insufficient-evidence prose. A proposed grounded answer is released only after an independent verifier supports every material claim; unsupported, invalid, or failed verification returns the fixed safe fallback and is atomically logged against the same validated transcript snapshot. Exact retries reuse the committed result without a second verifier call.

## Collaboration

Before changing the repository, read:

1. `docs/MULTI_AGENT_WORKFLOW.md`
2. `docs/MILESTONE_PLAN.md`
3. The assigned file in `docs/tasks/`
4. Relevant records in `docs/adr/`

Until repository branch protection is confirmed, the temporary default-branch write policy recorded in `docs/TASK_BOARD.md` applies.

Experimental model-named branches are reference material only. New task branches start from the latest reviewed `main` baseline.
