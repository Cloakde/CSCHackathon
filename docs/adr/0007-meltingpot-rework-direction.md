# ADR 0007 — MeltingPot as the Post-Class Destination

**Status:** Accepted product direction; implementation and the new handoff contract remain pending

## Decision

The Product Owner approved developing the extension together with a reworked MeltingPot, then approved revising the milestones to match. The extension serves the student during a lecture. MeltingPot becomes the place to review confusing topics and practice afterward.

Work on MeltingPot stays in the separate sibling `MeltingPot-rework` copy. Its preparation baseline is `89a15ffa95aa227648a3aac81382eed558ebfa81`, copied from `Rayrayyh/Melting-Pot` at `843ebeea1a9cf041355abc0dca167a5c2a1b281b`. The source history and license remain intact. Neither `Rayrayyh/Melting-Pot` nor `Rayrayyh/Meltingpot`, their original local checkouts, or their live services may be changed by this work. The rework copy has no configured remote and blocks pushes. This decision does not authorize publishing that copy or combining repositories wholesale.

M0 remains complete. M2's implemented local prototype remains protected, with human, actual AI, and judge-access acceptance still pending. M3 is the next build milestone: private lecture review in the rework copy, connected to the extension, followed by targeted practice and a return to the supporting transcript passage. M4 and broader redesign wait until that journey works for a learner.

## Required Boundaries

- Begin with synthetic lectures and transient state in an isolated test setup. Do not connect inherited MeltingPot credentials, accounts, database tests, or deployment settings.
- Before changing either app's handoff, review a contract for lecture/session identity, transcript chunk references, concepts, confusion events, practice targets, access, and reset/deletion. Preserve ADR 0002's storage boundary and ADR 0003's grounding guarantees.
- ADR 0006 remains the truth for the current prototype. Its fixed loopback origin, path-only handoff, and demo header cannot simply be reused as public authentication or relaxed to admit another app. A new handoff/access design needs its own reviewed decision before implementation.
- Transcripts, confusion, and individual practice progress stay private. They must not automatically become shared Pot contributions or appear in class or teacher reports. Sharing requires a separate, explicit student action under the existing review rules; building a sharing feature is not required for M3.
- Reuse suitable MeltingPot components without inheriting shared-class data access or reporting behavior. Existing notes, flashcards, and quizzes do not prove that personal lecture practice is integrated.

## Consequences

Keep the current M2 companion as a working prototype until the replacement passes its gates. Do not expand it into a second competing post-class product. The new copy's build and 257 local tests are baseline evidence only; the connected journey needs its own automated and uncoached two-concept learner checks, including citation return, failure recovery, and privacy.

Actual AI evidence remains a separate M1 requirement and runs alongside core work when assigned and authorized. Live audio remains conditional. No dates, provider replacement, spending, browser control, production services, durable storage, or final submission scope are approved by this direction decision.

If the MeltingPot connection cannot meet the freeze, cut optional work first and record the blocker. Using the old companion as the final submission requires an explicit Product Owner scope decision and cannot be reported as completed M3. Release records must identify both delivered repository revisions and distinguish inherited MeltingPot work from the new integration.
