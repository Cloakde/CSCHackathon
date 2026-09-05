# LiveLecture AI — Milestone Execution Plan

**Status:** Active plan; calendar activation is required before Day 1

**Companion to:** [MULTI_AGENT_WORKFLOW.md](MULTI_AGENT_WORKFLOW.md)

The workflow document defines how contributors coordinate. This document defines what gets built, in what order, and what is cut when time runs out. If the documents conflict, the workflow controls.

The approved product direction is **the extension during class, MeltingPot afterward**, as recorded in [ADR 0007](adr/0007-meltingpot-rework-direction.md). M0 is complete. M2's local prototype is implemented, with acceptance evidence still pending. M3 is the next build milestone. Milestone numbers and historical task records are retained; working-day ranges remain provisional and do not activate calendar dates.

---

## 1. Schedule Activation

The Product Owner and Coordinator must record these in the authoritative tracker before non-bootstrap feature work:

- Actual start date and timezone.
- Submission deadline.
- End-of-Day-5 live feasibility decision.
- Day-10 integrated demonstration window.
- Feature-freeze timestamp at the end of Day 15.
- Release-candidate deadline at the end of Day 18.
- Day-18 clean-environment rehearsal.
- Day-19 final rehearsal and packaging window.
- Human live-capture/audio verification windows for scheduled live work; record NOT APPLICABLE only if Live is explicitly CUT. Core learner and judge-access rehearsals still require their own windows.
- Available engineering lanes.

The plan assumes approximately twenty working days across four weeks. Day 20 is contingency for recovery and submission, not planned feature development.

M1 and M2 overlap. After schedule activation and approval of the minimum shared contracts, the main implementation priority is the complete simulated learning experience. Optional live-audio work must not delay it. Day numbers remain provisional until the actual deadline and available working time are confirmed.

### Confirm the Judges' Experience Early

The Coordinator owns a requirements check with the Product Owner at activation, before choosing hosting, durable storage, or the submission setup. Record the official rules/source and checked date, judging criteria, demonstration length, required artifacts, and how judges will try the project: install the extension, visit a website, watch a recording, or a required combination. Record permitted AI/simulation disclosures and access or network constraints; do not guess competition requirements.

Any unresolved requirement remains explicit in the task board. Reversible local Simulation work may continue, but dependent hosting, storage, and distribution choices wait for the relevant answer. The first complete demonstration must exercise the confirmed judge access route, including installation or opening links where applicable; the final rehearsal repeats it.

---

## 2. Product Cut Line

### Must Ship

- Prominently labeled Simulation Mode.
- Timestamped transcript display.
- “I’m Lost” grounded in existing transcript chunks from the labeled active source.
- A clickable citation that resolves to an existing transcript chunk.
- Confusion-event logging.
- Session end and handoff to private lecture review in the separate MeltingPot rework copy.
- “Practice My Weak Areas” using the same confusion event.
- Personal lecture, confusion, and practice data remain private unless the student explicitly chooses to share.
- Visible source/capture state and reliable Stop/reset behavior.

### Conditional Live Target

- Selected-tab audio capture.
- Audible tab-audio passthrough.
- ElevenLabs Scribe realtime transcription.
- Reconnection without duplicate chunks or broken lecture timestamps.

The live target receives a hard **CONTINUE** or **CUT** decision at the end of Day 5 based on its independent component spikes. Final **LIVE PASS** is reserved for the integrated human preflight by Day 18. A cut live target does not block the must-ship simulated product.

### Should Ship

- General grounded Ask.
- Catch Me Up or Explain This.
- Bookmarks.
- Durable sessions and deletion from active application stores and derived artifacts, with external retention limitations disclosed.
- Structured notes.

### Stretch

- Rich dashboard analytics.
- Full flashcard workflow.
- Multiple quiz modes and difficulty controls.
- Comprehensive study guide or export.
- Embedding or vector retrieval.

Stretch work cannot start while the must-ship callback fails on the default branch.

---

## 3. Architecture Baselines

These are constraints. Provider and deployment choices still require ADRs.

### One Event Contract

Simulation and Live sources emit the same validated transcript events. The interface and downstream services must not contain separate business logic for simulated transcripts.

### Replaceable Session Storage

All session data goes through a **SessionStore** boundary:

- Begin with an in-memory implementation and deterministic reset.
- Add durable storage only after the must-ship vertical slice is green.
- A deployed shared store requires authentication, per-session authorization, and database-level isolation.
- If durable transcript storage ships, deletion from active application stores, derived artifacts, browser storage, and caches ships with it. Provider, operational-log, and backup-retention windows that cannot be erased immediately must be disclosed separately.
- Do not use process-local SQLite for a serverless deployment without a compatible hosted service.

### Backend-Owned Secrets

Permanent ElevenLabs and generation-model credentials remain server-side.

The extension receives a short-lived, single-use transcription credential from a protected backend endpoint. Token issuance receives origin, rate, quota, and spending controls. Every reconnect obtains a fresh credential.

### Grounding Before Retrieval Infrastructure

Do not begin with a vector database.

For the MVP:

- Use immutable transcript chunk IDs and timestamps.
- Select the relevant recent window plus lightweight lexical/topic matching.
- Reject nonexistent citations server-side.
- Test answerable, unanswerable, and adversarial transcripts.
- Add embeddings only after measured evidence shows they are needed.

### Explicit Simulation

Simulation fallback is selected or confirmed visibly. It never activates silently and never presents fixture content as captured live audio.

### MeltingPot Rework Boundary

M3 builds against the isolated MeltingPot rework copy, not either original repository or its live services. Preserve the M2 prototype while the replacement is developed. Review the new handoff/access contract before changing routes or origins; ADR 0006's private demo restrictions remain in force for the existing app. Reuse of MeltingPot's study UI does not authorize reuse of shared Pot data, teacher reporting, accounts, or production storage for private lectures. See ADR 0007 for the source baseline and privacy requirements.

---

## 4. Milestone Summary

| Milestone | Working days | Exit gate |
|---|---:|---|
| M0 — Canonical bootstrap | 1–2 | One reviewed baseline on the default branch |
| M1 — Early feasibility checks | 3–5, alongside M2 | Actual AI help measured or explicitly blocked; each optional live spike PASS or CUT |
| M2 — Current learning prototype | 3–10 | Implemented simulated loop; human/learner and judge checks still required, actual AI readiness reported separately |
| M3 — MeltingPot connection and resilience | 11–13 | Private extension-to-MeltingPot practice journey, citation return, learner checks, and core failure paths pass |
| M4 — Prioritized additions and reuse | 14–15 | Suitable study tools reused only after the connected journey and acceptance gates pass |
| M5 — Freeze and release candidate | 16–18 | Clean-environment rehearsal and backup recording pass |
| M6 — Final rehearsal and submission | 19–20 | Day 19 package ready; Day 20 held for contingency |

---

## 5. M0 — Canonical Bootstrap, Days 1–2

### Goal

Establish one buildable, testable repository baseline before parallel feature implementation.

### Work

- Create a bootstrap branch from the default branch.
- Port only approved scaffold material from experimental model branches.
- Scaffold extension and web shells.
- Split runtime schemas by domain and infer TypeScript types where practical.
- Create one deterministic lecture fixture.
- Create a labeled Simulation Mode streamer.
- Render simulated transcript events in the minimum interface.
- Establish real format, lint, typecheck, build, unit, and contract-test commands.
- Establish the initial deterministic smoke test.
- Select the authoritative task tracker and verify every model’s access.
- Establish branch protection or a temporary Coordinator-only push policy.
- Correct overlapping task ownership before assignment.

### Exit Gate

- Extension and web shells build.
- Fixture validates against runtime schemas.
- Simulation renders timestamped transcript events.
- Initial CI/check commands are real and green.
- Tracker, branch policy, and canonical baseline commit are recorded.

### Miss Policy

If the minimum gate misses Day 2:

1. Create a checkpoint commit and handoff.
2. Remove should-ship and stretch work from the active schedule.
3. Preserve the smallest buildable fixture-to-transcript-UI path.
4. Publish a revised baseline and recovery decision before proceeding.

---

## 6. M1 — Early Feasibility Checks, Days 3–5

Protect the M2 implementation lane first. Run early AI-help checks alongside that work using the same approved assistance boundaries. Capture and transcription are independent optional experiments, scheduled only when engineering and review capacity remain. M2 does not wait for their PASS/CUT decisions.

### First Priority — Actual AI Help

Before dependent provider work, the Coordinator assigns a bounded task and independent reviewer for the explanation generator, semantic evidence verifier, and targeted practice generator. Freeze the synthetic evaluation examples, expected evidence and answers, response-time target, maximum requests, and cost cap before an authorized run. Select and record providers through the existing ADR process; this plan does not select or replace a provider.

Use a small evaluation set with at least two different confusion concepts, an unanswerable request, and instruction-like transcript content. A human checks that explanations and practice answers are correct, material claims are supported by the cited lecture passages, and practice addresses the specific confusion rather than merely repeating its topic label.

Measure the full time from clicking “I’m Lost” to a usable, verified explanation, including retries and evidence verification, plus practice-generation time and total cost. Exercise requests while simulated transcript chunks continue arriving at normal playback speed. Help must complete within the agreed target without requiring the learner to pause the lecture. Stale-context handling must remain bounded and preserve ADR 0003's snapshot, independent-verification, and atomic-recording guarantees. If this cannot be achieved, record a blocking design finding rather than weakening those guarantees silently.

Record **PASS**, **CHANGES REQUIRED**, or **BLOCKED** with the exact commit, provider/model configuration, cases, measured timing, redacted cost, reviewer outcome, and limitations. PASS requires actual authorized model calls through the delivered assistance path and passing the agreed quality/time criteria. Scripted answers and fake verifiers cannot prove this gate.

Provider calls require a separately approved capped budget and the existing credential, retention, and data-safety controls. Until then, prepare synthetic cases and injected tests with zero provider traffic. A blocked paid check does not stop construction of the simulated flow, but actual AI readiness remains unproven. Any demonstration using scripted answers must disclose that separately from its SIMULATION transcript label. Presenting that narrower demonstration as the submission requires an explicit Product Owner scope decision.

### Lane A — Chrome Capture

Prove:

- Chrome 116-or-later MV3 configuration.
- Qualifying user invocation for selected-tab capture.
- Service-worker stream-ID handoff to an offscreen document.
- Immediate offscreen stream consumption.
- Audible passthrough through Web Audio.
- Recording indicator and Stop/reopen path outside the side panel.
- Correct behavior when the side panel closes.
- Explicit Stop, duplicate Start, and tab-close handling.

### Lane B — ElevenLabs Transport

Prove:

- Protected backend single-use-token issuance.
- One selected mono PCM format and tested chunk sizes.
- Scribe realtime connection using the temporary credential.
- Committed transcript events with timestamps.
- Fresh credential on reconnect.
- Visible handling of quota, rate, and provider session limits.
- Preservation and deduplication of committed chunks.

### Optional Live Decisions and Ownership

Each live lane is:

- **PASS:** reproducible evidence and required human checks are attached; or
- **CUT:** checkpoint evidence is preserved and Simulation Mode remains the committed demo path.

The end-of-Day-5 live decision remains a hard limit. If capacity or authorization is unavailable, record CUT and preserve any evidence; do not borrow the core lane or block M2. Later Live integration still requires both spike PASS decisions and the integrated human preflight.

TASK-101 currently owns extension UI files also needed by M2, and TASK-102 owns a shared export hotspot. Separate engineers alone do not make those tasks safe to run together. The Coordinator must sequence conflicting work or amend ownership into exclusive paths before assignment. No parallel task may modify the same file, and no raw provider types may leak into the shared transcript contract.

---

## 7. M2 — Current Learning Prototype, Days 3–10

### Goal

TASK-201–204 implemented this local simulated learning loop. Keep that completed work and its automated regression checks. Chrome/manual behavior, the uncoached learner check, actual AI evidence, and judge access remain pending as recorded on the task board; this is not a whole-milestone PASS. M3 is now the next build milestone. Its bounded synthetic preparation may proceed after its own task gates while pending M2 evidence is arranged; no pending acceptance is waived or silently marked complete.

The following scope and gates describe the existing prototype. Its companion remains a fallback/reference while the MeltingPot replacement is built. A passed check on this prototype does not establish acceptance of the new destination; repeat the complete learner and judge journey on the M3 connection before release.

Before its branches start, freeze the minimum contracts for the “I’m Lost” response, citation, confusion event, session handoff, weak-area drill, and SessionStore. Reuse the reviewed bootstrap contracts where sufficient, and serialize any required shared changes before their consumers start.

Complete the product’s differentiating callback across extension, backend, and companion app:

    simulated session
    → timestamped transcript
    → “I’m Lost”
    → citation resolving to an existing chunk
    → confusion event
    → session end
    → companion-app handoff
    → weak-area drill based on that same event

### Parallel Lanes

#### Extension

- Side-panel shell and source-state indicator.
- Transcript display.
- “I’m Lost” action.
- Citation jump and highlight.
- Session end/handoff.

#### Assistance Backend

- Transcript ingestion against the canonical contract.
- Grounded “I’m Lost” response.
- Server-side citation existence and support checks.
- Confusion-event creation.
- Deterministic fake generation provider for CI.

#### Companion Web App

- Session landing screen.
- Confusion concept display.
- Minimum “Practice My Weak Areas” action.
- Targeted drill generated from the recorded confusion concept.
- A learner can attempt the question and inspect its correct answer and explanation; a full quiz system or automated grading is not required.

### Exit Gate

- The full deterministic callback passes in CI.
- A person who did not build the app completes the learner demonstration below by the end of Day 10.
- Grounding receives independent review.
- The confirmed judge access route works in that demonstration; unresolved access requirements are recorded as blockers to submission readiness.
- Actual AI quality has its own measured M1 result. A working scripted flow does not establish AI product readiness; record any missing proof and obtain explicit Product Owner acceptance before treating a disclosed scripted demonstration as the submission scope.
- Findings are recorded for M3.

### Learner Demonstration

Using synthetic lecture content, the participant must proceed without coaching from the builders: mark “I’m Lost,” read a helpful explanation, open its supporting timestamp, end the session, reach the companion app, attempt the targeted question, and find its answer and explanation. The participant should be able to describe why that practice was suggested and what to do next. Record confusing steps and fix failures that prevent this journey before calling the learner demonstration PASS.

Repeat with a second, distinct confusion concept. Confirm that the selected explanation, evidence, and practice change appropriately; swapping an identifier or topic heading on the same question is insufficient. A knowledgeable reviewer checks both questions, answers, and explanations. This is an acceptance check for the existing small practice flow, not a new quiz suite or a claim of measured long-term learning improvement.

Report functional automated checks, learner demonstration, actual AI quality, and judge-access readiness separately. Once the full deterministic callback first passes, it becomes a required pull-request check; do not wait for the end of Day 10 to protect it.

### Miss Policy

If the callback is not demonstrable by the end of Day 10:

1. Cut M4 should-ship breadth.
2. Defer Live and durable-storage integration.
3. Use Days 11–15 to recover the simulated callback.
4. Preserve the Day-15 feature freeze.

---

## 8. M3 — MeltingPot Connection and Resilience, Days 11–13

### Goal and Sequence

Finish a lecture in the extension, open its private review in MeltingPot, see why a topic needs practice, answer a relevant question, and return to the supporting transcript passage.

1. Define and independently review the handoff/access contract, using the current exact bases in both repositories. Preserve session, concept, confusion-event, and citation identity. Name exclusive file ownership before assigning consumers.
2. Build the private lecture-review area in the isolated MeltingPot copy with synthetic examples and transient state. It must run without the original project's accounts, keys, database, or live deployment. Do not start the inherited app against production services.
3. Connect the extension's Finish action to that area. Preserve the current M2 demo until the new path passes; do not merely redirect to an unrelated class page or put lecture content or credentials in URLs.
4. Connect concept-specific practice and resolving transcript citations. Reuse suitable study components only where they preserve private data and source references.

No full MeltingPot redesign, shared-class publishing feature, new database, or provider change is required to prove this first journey. Each implementation task needs its own reviewed contract, current base, owned paths, and applicable authorization. This plan revision does not itself assign those tasks.

### Work

- Fix outstanding M2 findings and findings from the connected MeltingPot demonstration.
- Keep personal transcripts, confusion, and practice separate from shared Pot contributions and teacher reports. Any later sharing requires an explicit student action and the existing contribution-review rules.
- Test missing, stale, wrong-session, and deleted handoffs; repeated Finish; unavailable destination; practice failures; citation return; and deterministic reset/deletion. Errors must be visible and recoverable without crossing lecture identities or exposing data.
- Resolve blocking learner-flow and actual AI-quality findings before optional feature breadth. Any proposed change to grounding guarantees requires its own reviewed decision.
- Integrate the live adapter only if both required live spikes passed and the core MeltingPot connection has protected engineering/review capacity.
- Keep Live and Simulation behind the same transcript-source interface.
- Test provider disconnect, reconnect, and duplicate prevention.
- Test side-panel closure and service-worker lifecycle recovery.
- Add durable storage only if:
  - The must-ship callback is green.
  - Deployment requires persistence.
  - Authentication, session authorization, and data isolation are approved.
- If persistence ships, implement the deletion scope defined in Section 3 and disclose external retention limits.
- Otherwise retain deterministic in-memory reset/delete behavior.

### Exit Gate

- The existing M2 callback remains green, and the new extension-to-MeltingPot callback has automated coverage tied to exact revisions in both repositories.
- An uncoached learner completes the connected journey for two distinct confusion concepts, including answering practice, finding feedback, and returning to the correct transcript passage. A knowledgeable human reviews both sets of content. Existing prototype-only evidence does not satisfy this gate.
- Private lecture data do not automatically enter shared Pots or teacher reports. The handoff/access contract and failure paths receive independent review.
- Track M2 acceptance findings, actual AI quality, and the chosen judge access route separately. Resolve them for the claimed release scope and repeat the judge route with the delivered extension and MeltingPot revisions; scripted help still requires honest disclosure and explicit scope acceptance if used for submission.
- Any enabled live mode passes its human browser/audio checks.
- Core provider and application failures produce visible recoverable states.
- No persistence is enabled without its access-control and deletion gates.

### Miss Policy

If M3 is not complete by the end of Day 13:

1. Disable any unintegrated Live mode for the release candidate.
2. Use Days 14–15 for the missing MeltingPot connection and unresolved must-ship resilience.
3. Cut should-ship breadth rather than moving feature freeze.
4. If the connection still cannot ship, record the blocker and obtain an explicit Product Owner decision on any M2-only submission fallback. Do not call the old companion a completed MeltingPot milestone.

---

## 9. M4 — Prioritized Additions and Reuse, Days 14–15

Add only the highest-value work after the connected M3 callback, learner demonstration, privacy checks, and approved submission scope are ready. Unresolved actual AI quality or judge-access blockers take priority. Broader MeltingPot redesign and unrelated screens wait until this gate. Inspect existing notes, flashcard, and practice components before building equivalents; reuse does not waive grounding, privacy, or acceptance checks, and existing features do not automatically enter scope.

Prioritize:

1. General grounded Ask.
2. Catch Me Up or Explain This.
3. Bookmarks.
4. Structured notes.
5. Durable storage, only if still justified and gated.

Feature freeze begins at the end of Day 15. Unfinished work is disabled or cut rather than carried invisibly into hardening.

Complete the feature-freeze rehearsal before M5 begins and record its findings.

---

## 10. M5 — Freeze and Release Candidate, Days 16–18

No new features.

### Required Checks

- Deterministic full callback.
- Clean-profile extension installation.
- Selected-tab capture and audible passthrough, if Live remains enabled.
- Indicator and Stop behavior with the panel closed.
- Long-session and reconnection behavior, if Live remains enabled.
- No duplicate chunks and monotonic lecture timestamps, if Live remains enabled.
- Deterministic Simulation continuity and reset behavior in every release candidate.
- Generation timeout and invalid-structure states.
- Keyboard navigation and contrast.
- Permission minimization.
- Prompt-injection and unanswerable-question behavior.
- Deletion and authorization, if persistence is enabled.
- Retention settings and limitations recorded for every provider receiving audio or transcript content.
- README setup steps run from a clean environment.
- Repeat the accepted extension-to-MeltingPot learner journey and judge access route on the release candidate, with transcript-source and scripted/actual-AI disclosures matching what is actually running. Record and test the exact revision of each delivered repository, including private-data separation and citation return.

### Day-18 Go/No-Go

Choose the live demonstration only if the live preflight passes completely. Otherwise disable Live for the presentation and use prominently labeled Simulation Mode.

By the end of Day 18:

- Tag or record the release-candidate commit.
- Complete the clean-environment rehearsal.
- Record a backup demonstration using synthetic fixture data or separately consented participants.
- Freeze the demo machine and runbooks.

---

## 11. M6 — Final Rehearsal and Submission, Days 19–20

### Day 19

- Rehearse the chosen primary runbook cold.
- Rehearse the Simulation Mode runbook.
- Verify the exact packaged extension and delivered MeltingPot revision; do not use the original MeltingPot deployment as the rework release.
- Finish submission text and artifacts against the official requirements recorded at activation; verify all previously resolved access and disclosure requirements still hold.
- Identify inherited MeltingPot work and the new lecture integration, retaining source attribution and license information.
- Confirm the backup recording is playable.

### Day 20

Reserved for:

- Recovery from a discovered release blocker.
- Final packaging.
- Upload and submission.

Do not schedule feature or routine hardening work for Day 20.

---

## 12. Critical Path

The must-ship critical path is:

    canonical schemas and fixture
    → simulated transcript
    → grounded “I’m Lost” and verified citation
    → confusion event
    → M2 prototype callback (implemented; acceptance pending)
    → reviewed MeltingPot handoff/access contract
    → private MeltingPot lecture review
    → weak-area drill and citation return
    → connected learner and judge-access demonstration
    → frozen release candidate

Real audio is a conditional adapter to this path. Its failure must not erase the demonstrable core product.

The core path starts during M1. Actual AI proof and judge-access preparation run alongside it and must be resolved for the claimed submission scope. Neither optional live-spike decisions nor paid-transcription availability gate the start of core implementation.

---

## 13. Risk Register

| Risk | Early trigger | Response |
|---|---|---|
| Tab capture or passthrough fails | M1 human capture check | Cut Live at Day 5; retain evidence and Simulation Mode |
| Scribe authentication or socket fails | M1 provider spike | Cut Live or timebox an approved proxy spike; never expose the permanent key |
| Reconnect duplicates or loses transcript | M1/M3 reconnect test | Preserve committed chunks, mint a new token, deduplicate by stable IDs |
| Grounded response cites irrelevant text | M2 evaluations | Reject invalid IDs, check claim support, default to not found |
| “I’m Lost” is slow or repeatedly invalidated as the lecture advances | M1 actual AI check during continued playback | Bound recovery, measure the full verified response path, and resolve the design without weakening grounding guarantees |
| Confusion concept is too vague | M2 callback test | Constrain extraction to concepts supported by transcript evidence |
| Practice is linked correctly but irrelevant, incorrect, or confusing | M1 content review and M2 two-concept learner demonstration | Fix targeting, question content, and answer explanations before breadth |
| Scripted success is mistaken for proven AI help | Separate M1 actual-AI result | Keep the proof pending and disclose scripted answers; obtain an explicit scope decision if used for submission |
| Judges cannot open or use the submitted demo | Activation requirements check and first complete rehearsal | Resolve the required access route early; defer dependent hosting/storage choices until requirements are known |
| Durable storage exposes sessions | M3 authorization test | Disable persistence and remain local/in-memory |
| A private lecture becomes shared class material or teacher-report data | M3 data-flow and access review | Separate private lecture state; require explicit student sharing; block release on unintended exposure |
| New handoff loses the lecture, confusion concept, or citation | M3 two-concept callback and retry/reset tests | Reject mismatched or missing references and preserve the working M2 prototype |
| MeltingPot redesign delays the complete journey | M3 scope review | Defer unrelated screens and reuse only suitable private study components |
| Provider retains submitted audio/text | M1/M5 privacy preflight | Disclose the limitation; use synthetic or separately consented demo data |
| Coordinator becomes a bottleneck | More than two changes awaiting integration | Reduce active lanes and cut lower-priority work |

---

## 14. Cut Order

When behind, cut in this order:

Defer unrelated MeltingPot redesign before cutting the learning journey. Existing inherited features are not new commitments; the order below applies to additions planned for this release.

1. Study guide and export.
2. Quiz variations and difficulty controls.
3. Full flashcard workflow.
4. Dashboard analytics.
5. Structured notes.
6. Bookmarks.
7. Explain This.
8. Catch Me Up.
9. General grounded Ask.
10. Durable storage.
11. Live capture and transcription.

Never cut:

- Prominently labeled Simulation Mode.
- Timestamped transcript.
- Grounded “I’m Lost.”
- A real resolving citation.
- Confusion logging.
- The weak-area callback.
- Private lecture-data boundaries. Replacing the planned MeltingPot destination with the M2 companion requires an explicit scope decision.
- Honest source labeling and capture safety.
