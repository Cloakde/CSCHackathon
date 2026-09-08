# Sample lecture: setup and later human check

Prepared 2026-09-06. **This check has not been performed.** The product is a Chrome side panel during class and private MeltingPot practice afterward. This version uses a sample transcript and prewritten help; it does not listen to audio or call Gemini.

## Operator setup, before inviting a learner

These are instructions for a later user-authorized session, not permission for an AI to control the laptop or start the rework app now. Use only the isolated copy below. Do not use an original MeltingPot checkout, account, database or website.

1. In PowerShell, enter the LiveLecture folder and verify `shared/livelecture` plus the reviewed revision recorded in `HANDOFF.md`:

   ```powershell
   Set-Location 'C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon'
   git status --short --branch
   git rev-parse HEAD
   node --version
   npm --version
   ```

   Use Node 24 and npm 11.9.0. On a fresh installation, use `npm ci`. Preserve dirty files. Check that ports 3000 and 3111 and both repositories' build folders are not in use; do not stop another person's preview or rebuild underneath it. Run `npm run check` before starting a preview.

2. In Chrome, open `chrome://extensions`, turn on Developer mode, and choose **Load unpacked**. Select `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon\extension\dist`. Copy its 32-letter extension ID. In the LiveLecture terminal, replace the placeholder and run:

   ```powershell
   npm run dev:demo -- --extension-id=YOUR_32_LETTER_EXTENSION_ID
   ```

   Use the exact ID, not a wildcard. No keys or environment file are needed. Keep this terminal running.

3. In a separate terminal, prepare the isolated companion using its guarded commands:

   ```powershell
   Set-Location 'C:\Users\abuiz\Documents\Codex\2026-09-04\MeltingPot-rework'
   git status --short --branch
   git rev-parse HEAD
   node scripts/rework-check.mjs build
   node scripts/rework-preview.mjs
   ```

   Expected copy revision for the present evidence is `9244a641e0639982d4eece09b2274a05ee355096`. If dependencies are missing, follow this copy's `REWORK.md` locked installation instructions. Never use the inherited normal dev/start or database/browser-test commands. The guarded preview uses `http://127.0.0.1:3111/lectures`; it rejects an ordinary/stale build and inherited service settings. Build commands may download public dependencies/fonts. Keep this terminal running too.

4. Pin/click the extension in Chrome and open its side panel. It should say **SIMULATION**, **PREWRITTEN DEMO HELP**, and that no audio is captured. It requests no microphone or tab-audio access. After **Finish lecture**, **Open in MeltingPot** should open `http://127.0.0.1:3111/lectures/<session ID>` with no lecture text in the URL. An unavailable companion must not silently send the learner elsewhere.

The explicit browser rehearsal at `http://127.0.0.1:3000/demo/meltingpot` shares the lecture component and correct destination, but does not count as installing the extension. `/demo` opens the older prototype companion and is only a regression fallback.

For a builder rehearsal, the fixture introduces inner/outer functions by 2:30 and the inner derivative by 5:10. Pause at those lecture times and request help to obtain two distinct practice topics. Default playback is 12×; the eight-minute fixture takes about 40 seconds. Do not give these timing hints during the learner acceptance task below.

## Learner task card

Give the learner only this card, without walking them through the interface:

> Use the sample lecture. Ask for help at two different ideas you find confusing. Finish the lecture and find your practice in MeltingPot. Try both questions, check the explanations, visit the lecture passage behind one answer, and return to your unfinished answer. Delete the sample lecture when you are done. Say what felt unclear and whether the practice matched the help you requested.

Record what they did unaided, where help was needed, and whether two different concepts were reached. If they did not reach both, record that limitation instead of claiming the whole journey passed. A subject reviewer separately checks the mathematics, selected concepts, explanations and citations.

## Expected outcomes and recovery

| Check                        | Expected outcome                                                                                                                                                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Start and early Help         | Playback starts once. Too little evidence gives an honest insufficient-evidence message.                                                                                                                                 |
| Pause / Resume / Stop replay | Pause/Resume controls playback. Stop ends playback without deleting saved help; Finish still completes the session. Reset deletes it and allows a fresh start.                                                           |
| Two help moments             | Each explanation cites an actual passage and saves the matching concept for later practice.                                                                                                                              |
| Finish / reopen              | Deliberate link to the private MeltingPot lecture, retained if opening fails; no silent destination change.                                                                                                              |
| Practice / feedback          | The two questions match their respective topics. Feedback is explicitly prewritten.                                                                                                                                      |
| Citation / return            | Citation focuses the right passage and time; Return to practice preserves the current written answer.                                                                                                                    |
| Delete / reset               | Deleted session cannot be reopened or restored by a late response. Refresh shows it unavailable.                                                                                                                         |
| Service unavailable          | Fixed error with retry/reopen path; no false success. Restore only the intended local service, then retry. A restarted LiveLecture service loses its memory-only sessions, so start a new sample if the old one is gone. |
| Keyboard and narrow panel    | Reach controls with Tab, activate buttons with Enter/Space, follow and return from citations, and use a narrow side panel without clipping or a focus trap.                                                              |
| Panel/browser lifecycle      | Close/reopen the panel, reload the extension and switch tabs; record actual state/error behavior. This is currently unverified, not guaranteed background capture.                                                       |

To exercise outage recovery, the operator may stop only the preview they started in this rehearsal using Ctrl+C, then restart it with the same guarded command. Do not interrupt unrelated services. End by deleting test sessions and closing only those owned previews. Do not record audio/video or screenshots without the user's session permission.

## Evidence still needed

Record both exact repository revisions, extension package checksums, Chrome version, setup result, learner observations and failures. Actual Chrome installation/layout/lifecycle, clean-environment setup, uncoached learner and content review, the chosen judge access route, and real provider evidence remain **PENDING**. The manual guide itself is not evidence of completion. API testing remains deferred; this card does not ask for a key or run it.
