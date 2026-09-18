# Candidate package and rehearsal

This is an extension used during class and a private MeltingPot review afterward. The package is prepared for review; it is not a hosted app, Chrome Web Store listing, human-accepted release or competition submission.

**September 18 checkpoint:** the actual extension-page → Gemini help → MeltingPot practice journey passed for two synthetic topics at normal playback, with sequential AI content/evidence review. A separate 94-second silent Simulation/prewritten draft recording is prepared locally. [Exact results, artifact locations and limitations](../ACCEPTANCE-2026-09-18/README.md) distinguish those checks from still-pending native capture, human and judge acceptance. The ordinary no-key demo remains prewritten.

The subsequent [transcript-overlap check](../ACCEPTANCE-2026-09-18/TRANSCRIPT_OVERLAP.md) passed at source `d14293c` (702 checks and exact-source CI): the transcript advanced during Help, and bounded recovery delivered a fresh verified answer in **5,056 ms**. Candidate `release/d14293cc125e/` preserves the updated source and unchanged isolated copy. Its paid allowance is closed; the ordinary package still runs without keys using prewritten help. Independent AI result/content review passed. The separate human/native/retention/judge gates remain open.

## Reproduce the ordinary package

Use Node 24 and the locked dependencies. In LiveLecture: `npm ci`, then `npm run check`. In the isolated MeltingPot copy, follow `REWORK.md` (pnpm 10.33.0) and run `node scripts/rework-check.mjs`. No keys or original MeltingPot services are needed. The fixture uses only synthesized speech; ordinary operation never captures it.

Run the paired component journey:

```powershell
npm run test:meltingpot -- --meltingpot-root=C:/Users/abuiz/Documents/Codex/2026-09-04/MeltingPot-rework
```

After scoped commits and independent review, package the exact pair:

```powershell
node scripts/package-release.mjs --meltingpot-root=C:/Users/abuiz/Documents/Codex/2026-09-04/MeltingPot-rework
```

The Windows packager requires clean repositories and the remote-free rework branch. It rebuilds the ordinary extension without inherited credentials, runs the packaged-worker verifier, and creates `release/<LiveLecture commit>/` without overwriting any previous candidate. Contents: extension ZIP, both exact source ZIPs, short setup note and SHA-256 manifest with both commits/trees. The live-test package is deliberately excluded. Packaging verifies build/source identity, not human installation or AI quality.

Source archives contain the rework code and preserved license, not dependencies, Git metadata or production settings. Keep the extracted MeltingPot archive separate from the original. Its guarded build needs a local Git repository to identify source files. From that fresh archive's root, run these setup commands before following the dependency-install instructions in `REWORK.md`:

```powershell
git init --initial-branch=rework/lecture-integration
git config core.hooksPath .rework-hooks
git config push.default nothing
git config remote.pushDefault DISABLED
```

No remote or commit is needed to run the unpacked demo. Never attach an original remote or copy an old environment file. The package manifest identifies the archived source; a new local Git repository does not restore the original commit history.

On Windows, extract the source archives into short local folder paths, such as `C:\ll\LiveLecture` and `C:\ll\MeltingPot-rework`. A fresh-install check with Node 24.14.0 reproduced a package-import failure when a nested dependency's `package.json` path reached 260 characters. The misleading error was `ERR_PACKAGE_IMPORT_NOT_DEFINED` for `#module-evaluator`. If that happens, use a fresh extraction in a shorter folder and reinstall the locked dependencies there; do not change dependency versions or copy service settings to work around it.

## Install and try

1. Extract `LiveLecture-extension.zip`. In Chrome's `chrome://extensions`, enable Developer mode and Load unpacked its `dist` folder. Pin the extension. This is done by the operator or during an explicitly permitted desktop-control session.
2. Copy the shown extension ID. From LiveLecture, start `npm run dev:demo -- --extension-id=YOUR_32_LETTER_ID`. No API key is needed. A clean production setup may use `npm run start:demo` after building.
3. From the separate MeltingPot copy, run `node scripts/rework-check.mjs build`, then `node scripts/rework-preview.mjs`. Use only this guarded launcher; do not use inherited app/database/browser commands. It serves `http://127.0.0.1:3111/lectures`.
4. Click the extension. Confirm **SIMULATION** and the prewritten-assistance disclosure. Start the sample. Use **I’m Lost** at inner/outer functions and later at the inner derivative. Check a timestamp, Finish, then **Open in MeltingPot**.
5. Try both practice topics, reveal feedback, visit a source passage and return to the unfinished answer. Switch topics and confirm each answer remains. Use source flashcards and review ratings, bookmark a passage, and download a study file before deleting the lecture. Reopen that file from the MeltingPot lecture home page. Follow the [study guide](../TASK-309/STUDY_GUIDE.md). An unavailable companion should retain the same reopening link rather than redirect elsewhere.

The ordinary demo stores sessions only in the local service's memory; they expire after 30 minutes or server restart. An already open review can retain loaded content. Bookmarks/answers are page-local and clear on navigation/deletion. Notes and study downloads are separate files the user keeps/deletes; they are never erased by deleting a session. Imported study files contact no lecture service or AI. The setup has no shared class, account or production privacy guarantee. It is intended for synthetic demonstration data.

For Gemini or live audio, use the separate approved runbooks. A mock labeled Gemini in a test is not evidence that the real model works. A webpage rehearsal also does not prove a Chrome installation.

Provider retention is separate from local session deletion. Google's published abuse-monitoring period is 55 days, despite ordinary request logging being disabled; this project's billing/data-sharing settings remain unverified. The real ElevenLabs test reported active retention and live acceptance remains blocked. Use the [current provider-data record](../ACCEPTANCE-2026-09-18/PROVIDER_RETENTION.md) for verified settings, official sources and remaining account-specific unknowns. Keep this delivered demo synthetic; deleting a local lecture does not erase provider-held records.

## Two-minute presentation draft

- 0:00–0:15: Explain the problem: students lose track during class and forget exactly what confused them afterward.
- 0:15–0:40: Show the extension beside the sample lecture. State clearly that its transcript and help are prewritten in this no-key demonstration.
- 0:40–1:05: Press I’m Lost, show the explanation and its clickable lecture passage; show a second distinct difficulty.
- 1:05–1:40: Finish and open private MeltingPot practice. Show that the exercises target those two moments, preserve an answer across a citation visit, and include source notes/bookmarks.
- 1:40–2:00: Explain the differentiator and the evidence limits: Gemini completed a separate bounded two-topic test; this recording uses prewritten help. Live audio, human usefulness and final release acceptance remain pending.

The authorized September 18 session produced two actual silent draft clips, local screenshots, a labeled preview and optional narration wording. They remain unpublished and need human presentation approval; the recording uses an accelerated synthetic sample, prewritten help and the actual built extension page in an isolated test browser. It does not show native Chrome toolbar installation. Follow the [current unaided learner guide and saved actual-Gemini answer packet](../ACCEPTANCE-2026-09-18/HUMAN_REVIEW.md) for the remaining learner and subject reviews. Confirm the final judge access route, public assets and AI/pre-existing-work disclosures before submission.
