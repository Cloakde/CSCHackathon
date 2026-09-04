# TASK-101 — Chrome Tab-Audio Capture Spike

**Tier:** 1

**State:** BLOCKED pending schedule activation, engineer assignment, and independent reviewer assignment

**Assigned engineer:** Unassigned

**Independent reviewer:** Unassigned; must differ from the engineer

**Timebox:** One working day; checkpoint and hard PASS/CUT at expiry, no later than the activated M1 Day-5 gate

**Exact base commit:** `5e3c412c72801c54e1fe6e3143ec599257ee0a1f`

**Dependencies:** TASK-001; completed Schedule Activation Gate in `docs/TASK_BOARD.md`

## Objective

Prove on Chrome 116 or later that LiveLecture AI can capture audio from exactly the user-authorized tab through a Manifest V3 service worker and offscreen document, preserve audible playback, remain controllable after the side panel closes, and recover truthful visible state after service-worker termination.

This spike does not transcribe, transmit, record, or retain audio. A PASS proves browser capture feasibility only; it does not enable Live in the product.

## Owned Files

The assigned engineer may modify only:

- `extension/public/manifest.json`
- `extension/vite.config.ts`
- `extension/offscreen.html` — new
- `extension/src/background.ts`
- `extension/src/capture-protocol.ts` — new
- `extension/src/capture-controller.ts` — new
- `extension/src/capture-client.ts` — new
- `extension/src/offscreen.ts` — new
- `extension/src/App.tsx`
- `extension/src/styles.css`
- `extension/test/background.test.ts`
- `extension/test/capture-controller.test.ts` — new
- `extension/test/capture-client.test.ts` — new
- `extension/test/offscreen.test.ts` — new
- `extension/test/App.test.tsx`
- `extension/test/manual/capture-fixture.html` — new, synthetic local audio only
- `scripts/verify-extension-package.mjs`
- `docs/adr/0004-chrome-capture-lifecycle.md` — new, records the measured PASS/CUT decision

## Forbidden Paths and Lane Boundary

Do not modify:

- `web/**`, `shared/**`, `.github/**`, root configuration, package manifests, or `package-lock.json`
- `docs/TASK_BOARD.md`, this task contract, workflow/milestone documents, or ADRs other than the assigned ADR 0004
- Any TASK-102 provider-transport path

Do not add ElevenLabs code, credentials, sockets, token issuance, PCM conversion, provider chunking, provider reconnect logic, transcript events, host permissions, remote `connect-src` destinations, SDKs, `MediaRecorder`, audio blobs, or audio-file persistence. TASK-102 proves the provider transport independently. A later integration task is the only task allowed to join the lanes.

## Contracts Consumed

- Chrome 116 minimum from the packaged manifest
- ADR 0002: Live and Simulation will eventually share the canonical transcript-source boundary
- Existing visible source-state and Stop behavior in the side panel
- Existing package verifier's local-only asset and least-privilege guarantees

This spike must not change the shared transcript schemas or pretend that capture has produced transcript content.

## Contracts Produced

- An extension-private, runtime-validated capture command/status protocol with a generation identifier on every command and acknowledgment
- A capture controller that exposes truthful `idle`, `awaiting_consent`, `armed`, `starting`, `active`, `stopping`, and `error` state without exporting the opaque stream ID
- A human evidence matrix bound to the exact reviewed commit
- An ADR that records observed browser behavior and the PASS/CUT decision for later integration

## Manifest Requirements

Keep `minimum_chrome_version` at `116`, keep `host_permissions` absent, and use only these permissions:

```json
["activeTab", "offscreen", "sidePanel", "storage", "tabCapture"]
```

All executable code and both HTML documents must be packaged locally. Any requested permission must be exercised by an acceptance test and justified in the handoff.

## Consent and Qualifying Invocation

Chrome documents tab capture as following a user invocation such as an extension action click. It does not document a click inside an already-open side panel as granting a different active tab. The spike must therefore use this fail-closed flow:

1. The user clicks the extension action while the intended lecture tab is active.
2. Directly inside that action callback and before any awaited storage or reconciliation work, the service worker calls `sidePanel.open()` for the current tab. It records an `awaiting_consent` target for that exact tab in `chrome.storage.session`; this is not an armed capture grant and expires after two minutes.
3. The panel explains that the spike captures only that tab's audio, not microphone or video; sends nothing to a third party; and stores no audio.
4. The user explicitly consents. Only that action changes `awaiting_consent` to a one-use `armed` state with a separate 60-second expiry.
5. The panel asks the user to click the extension action once more on the same tab.
6. That second `action.onClicked` event must match the consented `armed` tab and occur within those 60 seconds. Only then may capture start. A second click during `awaiting_consent` only reopens the disclosure and cannot capture.
7. Missing consent, either expiry, tab switching, tab closure, navigation before start, restricted pages, or a mismatched tab fails closed and requires a new disclosure and arm.

Replace the current automatic `openPanelOnActionClick` behavior with an explicit action listener so invocation, target selection, and panel opening are deterministic. On worker startup and extension update, explicitly call `sidePanel.setPanelBehavior({ openPanelOnActionClick: false })` before advertising the action as ready; Chrome may retain the previous preference from an installed build. The package verifier and an upgrade-path test must prove that the old `true` setting is cleared and that `action.onClicked` receives the next click. A one-click side-panel Start may be considered in a later task only if real-Chrome evidence proves the required grant behavior.

## Capture Handshake

1. Atomically transition the matching arm from `armed` to `starting`; only one capture may exist per extension profile.
2. Use `runtime.getContexts()` and a shared creation promise to find or create at most one bundled offscreen document.
3. Create it with reason `USER_MEDIA` and a truthful justification.
4. After the document is ready, call `chrome.tabCapture.getMediaStreamId({ targetTabId })`.
5. Send the opaque ID immediately to the offscreen document. No unrelated await, persistence, log, provider call, or retry may intervene.
6. The receiving handler's first asynchronous operation consumes the ID exactly once with `getUserMedia()` using tab-audio constraints and `video: false`.
7. Never persist or log the stream ID. A failed or delayed consumption requires a fresh user invocation; never reuse the ID.
8. Keep the `MediaStream`, `MediaStreamAudioSourceNode`, and `AudioContext` only in the offscreen document.
9. Connect exactly one source node to `AudioContext.destination` so the otherwise-suppressed tab audio remains audible without doubling or echo.
10. Enter `active` only after the offscreen document acknowledges a live audio track.

At the Chrome 116 floor, do not implement request/response messaging with a promise-returning or `async` `runtime.onMessage` listener. Use either `sendResponse` with a literal `return true` to keep the channel open or separate generation-tagged messages. Tests must exercise the actual message-channel pattern, including delayed acknowledgment and closed-channel behavior, rather than calling handler functions directly.

Chrome states that these stream IDs are single-use and expire after a few seconds, without promising an exact TTL. The implementation must not invent or depend on a numeric TTL for an issued ID. See the official [capture guide](https://developer.chrome.com/docs/extensions/how-to/web-platform/screen-capture), [tabCapture reference](https://developer.chrome.com/docs/extensions/reference/api/tabCapture), and [offscreen reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen).

## Required Behavior

- **Duplicate Start:** Calls received while `starting` or `active` report current state and do not create another offscreen document, request another ID, or consume another stream.
- **Explicit Stop:** Stop is idempotent. It stops every track, disconnects audio nodes, closes the audio context and idle offscreen document, clears session metadata, and clears indicators.
- **Panel closure:** Unmounting or closing the panel only unsubscribes that view. It never sends Stop; capture and passthrough continue.
- **Outside-panel visibility:** While starting or active, show a global `REC` action badge and a truthful action title. Chrome's browser-owned capture indication must also remain visible. An action click while active reopens the panel with Stop immediately available; it must not start a second capture or silently stop.
- **Tab close and track end:** `tabs.onRemoved` and the offscreen track's `ended` event converge on one generation-checked cleanup path. Native `tabCapture.onStatusChanged` events have no generation identifier, so treat them only as reconciliation hints: recheck `getCapturedTabs()` and query the offscreen document's current generation before cleanup. A delayed old `stopped` or `error` event must not terminate a newer capture on the same tab.
- **Same-tab navigation:** Do not intentionally stop a valid capture solely because the captured tab navigates. Record actual behavior in the manual matrix.
- **Service-worker restart:** Register event listeners synchronously at module scope. On wake, reconcile `storage.session`, `runtime.getContexts()`, `tabCapture.getCapturedTabs()`, and an offscreen status query. Restore active UI only when evidence agrees; clear stale state or clean up an inconsistent orphan. Never recapture automatically.
- **Stale events:** Ignore acknowledgments or terminal events whose generation does not match the current capture.
- **Data minimization:** Persist only capture-control metadata such as state, tab ID, generation, and timestamps. Never persist audio, the stream ID, tab URL/title, or page content.

Do not depend on `sidePanel.onClosed`; it is newer than the project's Chrome 116 floor. The offscreen document owns the capture independently of the panel lifecycle. See the official [side panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel).

## Observable Acceptance Criteria

- Capture cannot begin before explicit disclosure and affirmative consent.
- Only the armed tab can start, and an expired or mismatched arm fails closed.
- The offscreen document receives one audio track, no video track, and consumes one ID exactly once per generation.
- The captured audio remains audible exactly once.
- Duplicate Start, duplicate Stop, duplicate terminal events, and late old-generation messages are harmless.
- Capture remains active after at least 60 seconds with the panel closed, and the user can reopen the panel and Stop.
- A worker restart restores truthful state without requesting another stream ID.
- Explicit Stop and captured-tab closure each remove all live tracks, state, and indicators.
- No application/provider network request occurs and no audio or stream ID persists.

## Required Automated Verification

Tests must prove:

- Exact manifest permissions, no host permissions, and packaged offscreen assets
- Distinct pre-consent and consented-arm states, concrete expiries, action/tab matching, and proof that a second action click before consent cannot capture
- Startup/update migration from persisted `openPanelOnActionClick: true` to `false`, direct user-gesture `sidePanel.open()` invocation, and packaged-worker verification of the new setting
- One offscreen creation under concurrent starts
- One stream-ID request and one consumption attempt per generation
- Chrome-116-compatible asynchronous message channels, including delayed response and closed-channel behavior
- No stream ID in storage or logger arguments
- Audio-only constraints and exactly one passthrough connection
- Duplicate Start and Stop idempotency
- Panel unmount does not stop capture
- Deduplicated tab-close and track-ended cleanup; native status events trigger reconciliation rather than unqualified cleanup
- A delayed old native `stopped`/`error` event cannot terminate a newer same-tab capture
- Worker-restart reconciliation restores or clears state without recapture
- Old-generation messages cannot alter current capture
- Both HTML documents reference only packaged scripts and styles

Run and report:

```text
npm run test --workspace=@livelecture/extension
npm run typecheck --workspace=@livelecture/extension
npm run build --workspace=@livelecture/extension
npm run verify:extension-package
npm run check
git diff --check 5e3c412c72801c54e1fe6e3143ec599257ee0a1f...HEAD
git status --short
```

## Required Manual Verification

Mocks cannot replace the Chrome checks. Against the exact submitted commit, load the packaged extension unpacked in desktop Chrome, pin its action, and use only the synthetic local audio fixture. Record Chrome version, OS, commit SHA, and each outcome:

- Consent appears before capture; stale/wrong tabs cannot be captured.
- A second toolbar click before consent only reopens disclosure; it never requests a stream ID.
- Updating from the current packaged build clears the persisted automatic-open preference and delivers action clicks to the explicit listener.
- Intended-tab audio only is captured; microphone and video are absent.
- Audio remains audible once, without mute, doubling, or echo.
- Rapid repeated Start does not create another capture.
- Closing the panel for at least 60 seconds preserves capture, passthrough, Chrome indication, and `REC` badge.
- Clicking the action reopens a working Stop control.
- Explicit Stop restores ordinary playback and clears all indicators.
- Closing the captured tab performs complete cleanup.
- Same-tab navigation does not switch the capture target; actual continuation behavior is recorded.
- Terminating the service worker with DevTools closed leaves the offscreen-owned stream alive; reopening reconciles state and Stop works.
- More than 30 seconds of silence does not close the `USER_MEDIA` offscreen document.
- DevTools show no external/provider traffic and no persisted audio or stream ID. Serving the synthetic fixture over loopback is allowed and must be identified as such in the evidence.

Chrome service-worker globals are disposable, whereas session storage survives worker restarts but clears on extension/browser restart. See the official [service-worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) and [storage API](https://developer.chrome.com/docs/extensions/reference/api/storage).

## Security and Privacy Requirements

- Capture only after a current, tab-bound explicit consent flow.
- Never capture microphone or video.
- Never persist, serialize, log, or transmit raw audio or the stream ID.
- Never infer an active capture from stale state alone.
- Never silently switch source mode or claim Live before the human matrix passes.
- Use synthetic audio unless the Product Owner separately approves consented participant audio.

## PASS / CUT Decision

**PASS** requires, on the exact reviewed commit:

- All required commands green and a clean worktree
- Independent Tier-1 approval with no unresolved P1/P2 finding
- Every human Chrome matrix item passing
- A short screen recording showing panel close, persistent indicators, reopen, and Stop
- A redacted event trace showing ID issuance immediately followed by a consumption attempt without revealing the ID
- Evidence of one offscreen context, one audio track, no video track, and no provider traffic

**CUT** if intended-tab authorization, immediate one-use consumption, single audible passthrough, panel-independent capture, outside-panel Stop/reopen, duplicate suppression, tab-close cleanup, or worker-restart recovery is unreliable at the timebox/Day-5 gate. Preserve the exact checkpoint and evidence, do not merge a partial Live path, and keep the visibly labeled Simulation Mode as the committed demo path.
