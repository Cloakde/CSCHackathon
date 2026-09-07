# TASK-305 — Verify the core and add offline lecture questions and recap

- **State:** IN REVIEW, Codex implementation; user Execute on the preceding four-step proposal. Full local checks passed; final CI and independent review are recorded in the handoff/evidence.
- **Starting source:** clean shared `367aab29d7dd3f1a6866799f8934a60473a2f032`.
- **Scope amendment:** the user chose Codex to continue implementation and authorized fresh-install checks, core recovery fixes, Ask, then Catch Me Up. This permits these bounded simulation features before the previously deferred M4 acceptance gates. It does not accept M3/M4, approve Codex's own changes, authorize general AI answers, live audio, provider testing, credentials, laptop control or main promotion.
- **Working mode:** primary CSCHackathon checkout, only `shared/livelecture`, one AI. Original MeltingPot repositories/services protected; isolated rework copy remains read-only and uses only the existing guarded component test.

## Sequence and owned paths

1. Run existing clean-install GitHub CI using a draft shared-to-main PR; inspect failures and correct demonstrated in-repository issues. Review existing core recovery tests; retain working safeguards rather than refactor without a defect.
2. Add `shared/src/lecture-tools.ts` plus a focused `shared/test/lecture-tools.test.ts`, export from `shared/src/index.ts`. This is an additive contract for extension-only tools. Do not modify the seven existing shared schema files or rework vendor contracts.
3. Extend `web/src/server/demo-api.ts`, add `web/src/app/api/sessions/[sessionId]/lecture-tools/route.ts`, and focused adjacent dispatcher/component tests. Use the same local host/origin/header, bounded-body, cancellation, rate and session guards. Read only active canonical committed passages; do not store questions/recaps or add confusion events implicitly.
4. Extend `extension/src/demo-api.ts` and `App.tsx`; add `LectureTools.tsx`, styles in `styles.css` and focused extension tests. Flush uploads before a request, bind answers to the acknowledged snapshot, cancel/discard on reset/source change/Finish/unmount. Keep transcript delivery and existing Help independent. Preserve the MeltingPot Finish destination and explicit prototype fallback.
5. Extend `scripts/demo-smoke.mjs` with real local production HTTP checks for the new route. Update README, handoff, task board, assignments, narrow milestone/workflow override and `docs/evaluations/TASK-305/**`. No dependencies, manifests/permissions, CI configuration, provider adapters, frozen evaluation inputs, unrelated study screens or copy edits.

## Honest offline behavior

Ask exposes a small published list of prewritten sample questions, also accepting the same questions with harmless capitalization/spacing/end-punctuation differences. It does not infer intent from isolated keywords. Other questions receive an explicit limited-sample response, even if a related keyword appears. A supported question cannot be answered until its exact canonical supporting passages have arrived; citation offsets come from those passages. This is not general semantic Q&A or actual model evidence.

Catch Me Up is a short extractive recap of committed passages overlapping the latest two minutes at the requested snapshot. Each excerpt has its own exact citation. Display actual source times and label it as recent lecture excerpts, not an AI-generated summary. Never include future/partial text. Empty or unavailable evidence fails honestly.

Both tools bind to session ID and requested committed sequence; later uploads do not rewrite the requested snapshot. Server and client validate the canonical source and response. Lecture/question text remains untrusted data. Responses cannot name invented teachers/topics or use made-up timestamps. The normal demo stays synthetic/prewritten; no API calls, recording or durable data are introduced.

## Acceptance and handoff

- Existing fresh-install CI (locked install, all checks, history secret scan), core tests and separate read-only MeltingPot component journey pass on identified revisions.
- Supported questions on different topics have correct evidence; insufficient/unsupported/instruction-like/wrong-session/noncanonical input is rejected or explicitly refused. Truncated/future/edited/wrong-offset responses fail validation.
- Delayed upload/response, duplicate submit, reset, Finish, source replacement and deletion cannot revive old tool content. Transcript ingestion continues during tools; no duplicate confusion/practice records.
- Keyboard question submission and timestamp navigation use native controls; narrow styles retain readable content. Actual Chrome/layout/lifecycle and learner checks remain pending without session permission.
- Run full checks once changes settle, preserve failed evidence, record final source and CI. Leave IN REVIEW for another AI; do not self-merge. No provider request is the next automatic action.
