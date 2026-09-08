# ADR 0004 — Chrome Tab-Audio Capture Lifecycle

**Status:** Implemented offline; PASS/CUT decision DEFERRED — requires the separately authorized manual Chrome verification in [TASK-101](../tasks/TASK-101.md). This ADR records the implemented design and the reasoning behind its choices; it does not itself declare PASS.

## Correction after independent review — 2026-09-07

The original submission at `8336516` is CHANGES REQUESTED. Codex's correction is IN REVIEW and supersedes its offline correctness/inertness claims; [current evidence](../evaluations/TASK-101-102/README.md) records the findings and tests. Ordinary builds now explicitly disable capture. Only a separately prepared local capture-spike build uses `VITE_LIVELECTURE_CAPTURE_SPIKE=true`, and that flag does not authorize a Chrome session.

The toolbar call now runs before the asynchronous state queue. Navigation, tab switching and closure invalidate pending authorization; Stop cancels delayed acquisition, late streams are stopped, graph failures clean up, and missing track acknowledgments time out. Starting/active capture sets a REC badge and title; wake reconciliation requires both Chrome's captured-tab evidence and a live offscreen track. The simulation panel identifies its sample transcript even if a capture spike is active. The manual matrix remains unrun and required.

The design discussion below is retained from the original submission. Its historical test totals are not final correction evidence, and design intent is not proof of actual Chrome behavior.

## Context

[TASK-101](../tasks/TASK-101.md) requires proving that LiveLecture AI can capture audio from exactly the user-authorized tab through a Manifest V3 service worker and offscreen document, while remaining audible, controllable after the side panel closes, and truthfully recoverable after a service-worker restart — without ever transcribing, transmitting, or persisting audio.

This work was prepared offline, in an isolated copy, while a live-checkout capture holder session was in progress elsewhere. No Chrome, no real tab, and no manual verification were available. Everything below is implemented and offline-tested against injected fakes; it has not been run in real Chrome.

## Decision

### Consent as a two-click, tab-bound state machine

Chrome documents tab capture as following a user invocation such as an extension-action click, but does not document a click inside an already-open side panel as granting a different active tab's capture. The implementation therefore never treats a panel-only interaction as sufficient consent to start capture. It uses:

```
idle → awaiting_consent (2 min) → armed (60 s, one-use) → starting → active → stopping → idle
                                                                              ↘ error
```

Both the 2-minute disclosure window and the 60-second arm window are deliberately chosen, conservative, implementation-side bounds — Chrome does not mandate either duration. The **first** toolbar click opens the side panel and starts the disclosure timer; the panel's own explicit "I consent" button arms it; the **second** toolbar click, on the same tab, within the arm window, is what actually starts capture. A panel-only interaction can never start capture by itself.

### `sidePanel.open()` is called first, unconditionally, on every click

Chrome's side-panel API must be invoked directly inside the user-gesture callback to reliably open. Rather than branch on stored state _before_ deciding whether to open the panel — which risks that decision itself consuming the gesture window — every `action.onClicked` handler calls `sidePanel.open({tabId})` as its literal first statement, before any other await, then reads storage to decide what actually happens next. Reopening an already-open panel for the same tab is idempotent and harmless; this ordering trades a redundant call for a guarantee that the gesture-sensitive call is never delayed behind a state read.

### One shared, generation-tagged control-metadata record

All control state lives in a single `chrome.storage.session` record (state, generation, tabId, and windowed expiries only — never audio, never the stream ID). `chrome.storage.session` was chosen over in-memory service-worker variables specifically because it survives a worker restart while still clearing on browser/profile restart, which is exactly the risk window this task cares about (a worker restarting mid-capture, not a full browser restart reviving a stale capture days later).

Every command and acknowledgment across the panel↔background↔offscreen boundary carries an explicit `generation` number. A stale message — a delayed ack from a superseded attempt, an old native `tabCapture.onStatusChanged` event, a leftover panel message from a torn-down session — is rejected by generation mismatch rather than trusted. `tabCapture.onStatusChanged` in particular carries no generation identifier at all, so it is treated purely as a reconciliation _hint_: it triggers a fresh check against `tabCapture.getCapturedTabs()` and the offscreen document's own live status, never an unconditional cleanup.

### The offscreen document is the sole owner of the stream

The `MediaStream`, `AudioContext`, and the one `MediaStreamAudioSourceNode → AudioContext.destination` passthrough connection live only in the offscreen document (reason `USER_MEDIA`), found or created via `runtime.getContexts()` plus a shared creation promise so two concurrent triggers can never produce two documents. The background service worker never touches the stream ID after minting it: `tabCapture.getMediaStreamId({targetTabId})` is called, and the resulting ID is forwarded to the offscreen document with no other await in between, matching Chrome's documented single-use, short (undocumented-exact-duration) expiry for that ID. Only the offscreen document's own acknowledgment of a live audio track moves the record from `starting` to `active` — the background never assumes success from the mint call alone.

### Worker-restart reconciliation observes; it never re-captures

On every worker (re)start, `reconcileOnWake` reads the persisted record and, for an in-flight capture, checks live evidence (`runtime.getContexts()` for the offscreen document, then a generation-tagged `get_status` round-trip to it) before deciding to restore `active` or clean up to `idle`. It never calls `getMediaStreamId` or otherwise starts a new capture on its own initiative — an orphaned or unconfirmable record is always torn down, never guessed into activity.

One implementation subtlety worth recording: a status query that waits for an incoming ack must resolve that ack _immediately_, outside of the same per-controller serialization queue used for ordinary state transitions. Early in implementation, routing the ack through that queue created a self-deadlock — the reconciliation call was still occupying the queue while awaiting the very ack that could only be processed by advancing that same queue — which surfaced as the wait always timing out. The fix separates "resolve a pending status waiter" (immediate, synchronous with message arrival) from "process the ack's effect on stored state" (still queued, for real ordering guarantees against other state changes).

### Manifest permissions

`["activeTab", "offscreen", "sidePanel", "storage", "tabCapture"]`, no `host_permissions`. The prior manifest declared `host_permissions: ["http://127.0.0.1/*"]`, apparently for the existing demo API's `fetch` calls from the side panel; inspection of `web/src/server/demo-api.ts` shows the server already sends explicit `Access-Control-Allow-Origin` / `Access-Control-Allow-Methods` / `Access-Control-Allow-Headers` responses keyed off the request's own `Origin`, which is the mechanism that actually authorizes those cross-origin calls — not a declared host permission. Removing `host_permissions` is therefore expected to be safe, but this is an inference from reading the server's CORS handling, not a Chrome-verified fact; it is called out explicitly in [PREP_HANDOFF.md](../../PREP_HANDOFF.md) as an integration risk to confirm during real Chrome verification.

## What is proven, and what is not

**Proven offline (92 automated tests, typecheck, lint, build, and `verify-extension-package.mjs` all green):** the state machine's every documented transition and rejection (expired/mismatched consent and arm, duplicate Start, panel-unmount independence, tab-close and track-ended convergence, stale-generation rejection at every boundary, worker-restart reconciliation in both the "still active" and "orphaned" cases), the exactly-once stream-ID mint-and-forward sequence, the single passthrough connection, and that no audio, stream ID, or provider network traffic ever appears in storage or logs.

**Not established by this offline work, and explicitly deferred to the required manual Chrome matrix in TASK-101:** whether Chrome's real user-gesture rules actually accept this exact click sequence; the true behavior of a stream ID's undocumented expiry window under real scheduling; whether removing `host_permissions` actually leaves the existing demo API calls working; audible passthrough without doubling or echo on a real tab; the upgrade path clearing a previously-installed build's `openPanelOnActionClick: true`; and offscreen-document survival past 30 seconds of audio silence. None of these can be verified without loading the unpacked extension in real Chrome, which this preparation phase was explicitly not authorized to do.

## Consequences

- Live capture remains fully inert until a human runs the manual matrix in TASK-101 and records a PASS. Nothing in this change enables Live in the product.
- The generation-tagged protocol and the single shared storage record are reused, unmodified in design, by the ElevenLabs transport work in TASK-102 and the integration task that connects them (TASK-307) — both consume `TranscriptEvent`-shaped output, never the capture protocol's internal message types.
