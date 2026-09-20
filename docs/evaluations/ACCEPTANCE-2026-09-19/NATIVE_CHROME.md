# Native Chrome installation and bounded Simulation check

Performed September 19 Pacific / September 20 UTC, after the user opened Chrome's Extensions page and asked Codex to find an autonomous way through every installation step. This records actual native UI observations, not a clean-profile or human-acceptance result. No product source changed.

## Source and installation

- Primary documentation HEAD before this check: `bb81601c396cc879c870d43aa23675294a2da858`; runtime package `c97792142b8b3bf2401faa623b9feeb8cd59bf31`.
- All ten prepared `extension/dist` files matched `release/c97792142b8b/manifest.json` immediately before installation.
- Isolated companion stayed clean at `d03f99b14895c392355bcfa3c0c2985ad7073d31`. Original MeltingPot repositories/services were not used.
- Chrome already had Developer mode enabled. The existing profile also had other extensions; it was not a fresh profile.
- Direct clicking and field-value input encountered Computer Use's cached-element/owned-dialog failures. Supported keyboard navigation succeeded: Alt+N focused the Folder field, the checked absolute `extension/dist` path was typed, Enter navigated there, and a second Enter selected it. Visible Chrome state then showed **Extension loaded**, **LiveLecture AI 0.1.0**, enabled, ID `alpdibjjhlhlhbhjkoeblmlfcgoocclk`.
- Chrome's extension menu opened the actual side panel. Its native Pin to toolbar control worked; the toolbar icon and Unpin state confirmed pinning. No permission/security setting or safety barrier was bypassed.

## Native journey observed

The ordinary production demo launcher used the installed extension ID, prewritten assistance and no inherited provider credentials/activation. The isolated companion used its guarded preview launcher. Both bound to loopback, ports 3000/3111. No paid-test launcher or allowance was reused.

1. The native side panel disclosed **SIMULATION**, no audio capture, and after starting, **Prewritten sample help · no AI provider used**.
2. The eight-minute fixture ran at the visible **12×** setting and reached ten passages. The successful Help request occurred after replay reached 8:00; this check does not establish help during normal ongoing playback.
3. I’m Lost displayed **Remembering the inner derivative**, saved it for practice, and supplied the expected explanation and citations. Its 4:10–5:00 button visibly highlighted the corresponding lecture passage.
4. Finish displayed the practice handoff. Open in MeltingPot opened a new native Chrome tab for the same synthetic session, `session_4fb9b0bc751b45dbbfabb3a758f0d36a`.
5. The private review disclosed Simulation/prewritten assistance and showed one saved inner-derivative difficulty and its source flashcard. Selecting that moment produced the missing-factor exercise for `(2x + 3)⁴`.
6. A synthetic answer identifying factor 2 and derivative `8(2x + 3)^3` was entered. Show answer displayed the matching expected answer and explanation. The 4:10 citation highlighted its source passage; keyboard activation of Return to practice returned to the exercise with the typed answer and revealed explanation intact.
7. Delete sample lecture and its confirmation produced **Sample lecture deleted**, stating that transcript, confusion and practice were removed and page answers cleared. No study file was downloaded.

The tool's accessibility focus metadata sometimes remained on the address bar despite a visible field caret, and immediate snapshots could precede asynchronous UI/scroll completion. Inputs were checked against refreshed visible state; unsuccessful clicks are not counted as successful help requests or navigation. The preserved record contains the final practice and deletion state. One topic was tested, not the full two-topic learner acceptance exercise.

## Evidence and cleanup

External artifacts are under `C:\Users\abuiz\Documents\Codex\2026-09-04\you-are-taking-over-the-livelecture\outputs\acceptance-20260919\native-1789875228599\`:

- `ui-evidence.json`: captured native practice/deletion accessibility evidence and explicit limitations; SHA-256 `149ce030a8bc4d98a4189c8964dd0b678b253a35cc5d02fd4968bfdaddff1c35`.
- `started.json`, `livelecture.log`, `meltingpot.log`: ordinary launcher identity and local readiness.
- `owned-processes-before-cleanup.json`, `cleanup.json`: seven owned processes, including the controller, stopped with PID and creation-time checks; ports 3000/3111 confirmed closed.

The external preview controller was launched with closed stdin, so its interactive stop command was unavailable. Cleanup explicitly verified controller PID 35432, exact creation time `2026-09-20T03:33:48.4714730Z` and the task helper command, enumerated only its descendants, and rechecked each identity before stopping it. An initial date-comparison guard refused cleanup before any process was stopped; the exact UTC identity check then succeeded. No unrelated process was stopped. The controller's fifteen-minute timer was not left running.

The created review tab was closed, leaving the user's Extensions tab and installed/enabled/pinned LiveLecture extension. Both previews are stopped. There was no provider request, credential access, audio capture, original-service action, main merge or publication.

## Remaining acceptance

This closes the installation/menu/native-side-panel blocker and establishes one bounded prewritten native learning flow. It is author-recorded evidence, without a new independent review. Normal-speed in-class native use, actual capture/passthrough, clean-profile rehearsal, provider-account retention, unaided learner/subject review and final judge/release decisions remain separate pending gates. The current human guide still requires explicitly selecting 1× and testing two distinct concepts.
