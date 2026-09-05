# LiveLecture AI

LiveLecture AI connects a moment of confusion during a lecture to focused practice afterward.

## Current state

The local learning demo connects a sample transcript, “I’m Lost” explanations, clickable lecture evidence, saved confusion moments, and matching post-class practice. It covers two distinct calculus concepts: identifying inner/outer functions and including the inner derivative.

**The transcript is simulated and the help/practice are prewritten. No AI provider is called.** This proves the learning flow, not real AI quality or live transcription. Actual AI evaluation, an unpacked-Chrome check, an uncoached learner demonstration, and the final judge route remain pending.

No audio is captured or stored. Synthetic sessions live only in bounded local server memory; they expire, can be deleted, and disappear when the server restarts. This demo is not a public service or an authenticated multi-user app.

## Install and check

Use Node.js 24 and npm 11.9.0:

```bash
npm ci
npm run check
```

The check covers formatting, lint, secret scanning, types, automated tests, production builds, the packaged extension, and a real local HTTP walkthrough. Stop any existing server on port 3000 first; the check refuses to interfere with it. CI also scans Git history for secrets.

## Try the demo

```bash
npm run dev:demo
```

Open **http://127.0.0.1:3000/demo** yourself. The command does not open or control a browser. No keys or `.env` file are needed. Keep this server private; it binds only to your own computer.

1. Start the sample lecture. At the default 12× speed, its eight minutes play in about forty seconds.
2. After lecture time 02:30, pause and use **I’m Lost** to explore inner and outer functions. Click a timestamp to see its evidence.
3. Continue until after 05:10, then ask for help again to explore the inner derivative.
4. Finish the lecture and open the practice page. Choose each confusion moment, attempt its question, and reveal the answer and explanation.
5. Delete the sample session when done. Stop the server with Ctrl+C.

These steps are a builder rehearsal, not evidence that a new learner can use the app without coaching. The browser rehearsal reuses the extension's actual lecture component and the same HTTP API.

For a production-build rehearsal, run `npm run build` followed by `npm run start:demo`. The fixed address is the same. Ordinary `dev:web`/`start` commands do not opt the learning API into demo mode.

After building, `npm run verify:demo` runs a real HTTP check and stops its own temporary server. It requires port 3000 to be free, opens no browser, and never calls an AI provider. It checks the production pages and API across separate route modules.

## Optional Chrome extension rehearsal

The packaged extension now sends finished sample lectures to the separate MeltingPot rework preview at `http://127.0.0.1:3111/lectures/:sessionId`. The existing `/demo` rehearsal still opens the prototype companion. `/demo/meltingpot` rehearses the extension's new destination using the same lecture screen. These are explicit choices; an unavailable MeltingPot preview never silently changes the destination.

In the separate, prepared MeltingPot copy, install its locked dependencies and run:

```bash
node scripts/rework-check.mjs
node scripts/rework-preview.mjs
```

Its preview launcher permits only the isolated synthetic build, rejects inherited service settings/local environment files, and binds to port 3111. Keep the LiveLecture service running on port 3000. After Finish, choose **Open in MeltingPot**, practice a confusing moment, compare your answer, and use the lecture citation and **Return to practice** link. Answers stay in the page and are never added to a shared Pot or class record. Deleting the sample lecture clears its transient service data.

The paired automated check requires the unpublished local rework copy, so it is a separate required integration command, alongside this repository's usual CI:

```bash
npm run test:meltingpot -- --meltingpot-root=PATH_TO_REWORK
npm run verify:meltingpot -- --meltingpot-root=PATH_TO_REWORK --livelecture-server-root=PATH_TO_RUNNING_LECTURE_CHECKOUT --livelecture-server-commit=EXACT_RUNNING_REVISION
```

The HTTP check requires both previews already running, proves backend source parity before reusing a server, and deletes only its own test sessions. It never starts, stops, opens, or controls a browser. See `docs/tasks/TASK-301.md` and ADR 0008 for ownership, isolation, and the human/actual-AI acceptance still pending.

```bash
npm run build --workspace=@livelecture/extension
```

When you choose to use Chrome, open `chrome://extensions`, enable Developer mode, load `extension/dist`, and copy the extension's ID. Start the local server with that exact ID:

```bash
npm run dev:demo -- --extension-id=YOUR_32_LETTER_EXTENSION_ID
```

Click the extension action to open its side panel. The server permits only that configured extension origin and the local companion origin. The extension requests side-panel access and narrow loopback server access; no tab audio or microphone permission is requested.

The unpacked extension still needs a manual Chrome check. Automated component and package checks do not establish browser permission behavior or visual quality.

## Environment and data boundaries

The demo launcher explicitly enables `LIVELECTURE_DEMO_ENABLED=true` and optionally sets `LIVELECTURE_EXTENSION_ID`. The origin is fixed to `http://127.0.0.1:3000`. Every learning API request requires a nonsecret preflight header plus strict host/origin validation. This is a private demo boundary, not authentication or authorization for public hosting.

Permanent provider credentials must stay on the server, never use a `NEXT_PUBLIC_` prefix, and never enter extension bundles, URLs, or Git. Do not use real classroom recordings or student data in automated tests. No provider keys are required by this demo.

The server accepts only exact canonical synthetic transcript chunks. Assistance uses the existing revision-bound store transaction, server-owned citations, and a separate verifier that rejects altered scripted claims or evidence. Insufficient evidence produces a safe explanation of the limitation. Practice must match the selected stored confusion event and its supported concept.

Committed transcript passages continue uploading while an explanation is being prepared. Help can retry once if the transcript advances; cancellation prevents late saved results. Practice also passes a separate content check before it can be reused. These safeguards are exercised with injected delays and failures, while normal help and practice remain prewritten.

Run `npm run test:ai-readiness` for the frozen synthetic cases and the extension-to-service test at normal lecture speed. It uses no provider or browser. [The evaluation record](docs/evaluations/TASK-103/README.md) separates these engineering checks from the real-model trial, which still needs a selected provider, bounded cost plan and explicit spending authorization. The unchanged MeltingPot relay is checked against the new dispatcher separately; the preserved older running lecture server cannot establish new paired production HTTP evidence.

## Repository map

```text
extension/  Chrome side panel and reusable lecture/help screen
shared/     Runtime contracts, canonical fixture, grounding, and session store
web/        Local learning API, browser rehearsal, and companion practice page
scripts/    Demo launcher and repository verification
docs/       Milestones, workflow, task ownership, decisions, and evidence
```

## Collaboration

Read `AGENTS.md`, `docs/MULTI_AGENT_WORKFLOW.md`, `docs/MILESTONE_PLAN.md`, the assigned task contract, and relevant `docs/adr/` decisions before changes. `docs/TASK_BOARD.md` records ownership and readiness. Use isolated task branches and preserve existing work. Historical model-named branches are reference material only.
