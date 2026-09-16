# TASK-309 — Continue private MeltingPot study

**Assigned:** Codex, 2026-09-15. The user requested autonomous selection and execution of the next MeltingPot milestones. This extends TASK-308's implementation scope; it does not waive real-provider, Chrome, learner or release acceptance.
**State:** IN REVIEW. Implementation and local checks complete; exact paired production/package checkpoint is being prepared. One AI at a time on the existing branches. Real-service and human acceptance remain pending.

## Deliverables

1. Preserve each confusing moment's validated exercise, written answers and feedback while switching topics. Add an explicit personal review queue; self-ratings are not grades or evidence of mastery.
2. Add flashcards whose backs contain exact supporting transcript excerpts. Reuse MeltingPot's pure flashcard reducer, without inherited services, shared Pots or model calls. Keep citations and return focus.
3. Add explicit, versioned study-file download/import: transcript, confusing moments, saved exercises, answers, bookmarks and self-ratings. Validate size, canonical data and relationships on import. Imported files are editable, untrusted content, not independently verified AI evidence. Imported review works without the LiveLecture service and cannot call it. Downloaded files are user-managed; closing/deleting a session does not erase them.

## Ownership and boundaries

Codex owns the isolated copy's lecture pages/components/libraries/tests and rework documents. Primary-repository ownership is current coordination/evidence, related paired checks and release preparation. Existing branch `shared/livelecture` and copy branch `rework/lecture-integration` only. Frozen vendor contracts remain unchanged. No original MeltingPot checkout/remote/service, credentials, API traffic, database, browser storage, desktop control, deployment, main merge or submission.

## Evidence

Check state retention, stale response rejection, exact excerpt cards and citation return, round-trip file import, malformed/foreign/oversized file rejection, and zero service requests from imported packs. Run guarded copy lint/types/unit/build and the paired component/production HTTP journey. Independent review must be sequential, with author work paused. Offline results do not establish human or real-model acceptance.
