# ADR 0014 — Private study continuity and portable files

**Status:** Implementation direction authorized under TASK-309; acceptance pending.

The user's request to continue MeltingPot authorizes the next bounded study tools in the isolated copy. This amends ADR 0008's topic-change reset rule: validated exercises and answers now survive topic changes in page memory. Reloading or deleting still clears that memory. Reusing an exercise does not make another provider request.

Flashcards use exact transcript evidence from supported confusing moments. Ratings are the student's own judgment. They prioritize review without scoring, teacher reporting or claims of measured improvement.

A user may explicitly download and reopen a versioned JSON study pack. No automatic persistence is added. The pack contains one completed lecture, validated exercises and bounded personal progress. Imports are capped before parsing, validated against the unchanged canonical schemas and checked for cross-record references. Imported assistance/source claims are file contents, not independently verified provenance. No imported content is executed or used as an instruction.

An imported review is a separate page-local mode: it never calls the lecture service, generates missing exercises or deletes remote sessions. Closing clears only the page. Files remain wherever the user downloaded them; downloading later progress creates a new copy. This is not authenticated multi-user storage or a standalone offline website. Original services, shared Pots, inherited storage and model routes remain outside scope.
