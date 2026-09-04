# LiveLecture AI — Milestone Execution Plan

**Status:** Active plan; calendar activation is required before Day 1

**Companion to:** [MULTI_AGENT_WORKFLOW.md](MULTI_AGENT_WORKFLOW.md)

The workflow document defines how contributors coordinate. This document defines what gets built, in what order, and what is cut when time runs out. If the documents conflict, the workflow controls.

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
- Human browser/audio verification windows.
- Available engineering lanes.

The plan assumes approximately twenty working days across four weeks. Day 20 is contingency for recovery and submission, not planned feature development.

---

## 2. Product Cut Line

### Must Ship

- Prominently labeled Simulation Mode.
- Timestamped transcript display.
- “I’m Lost” grounded in existing transcript chunks from the labeled active source.
- A clickable citation that resolves to an existing transcript chunk.
- Confusion-event logging.
- Session end and companion-app handoff.
- “Practice My Weak Areas” using the same confusion event.
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

---

## 4. Milestone Summary

| Milestone | Working days | Exit gate |
|---|---:|---|
| M0 — Canonical bootstrap | 1–2 | One reviewed baseline on the default branch |
| M1 — Technical-risk spikes | 3–5 | Capture and provider spikes each PASS or CUT with evidence |
| M2 — Must-ship vertical slice | 6–10 | Full simulated callback demonstrated end to end |
| M3 — Integration and resilience | 11–13 | Live adapter integrated if passed; core failure paths work |
| M4 — Should-ship breadth | 14–15 | Prioritized additions land without breaking the callback |
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

## 6. M1 — Technical-Risk Spikes, Days 3–5

Run the spikes independently so one failure does not obscure the other.

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

### Exit Gate

Each lane is:

- **PASS:** reproducible evidence and required human checks are attached; or
- **CUT:** checkpoint evidence is preserved and Simulation Mode remains the committed demo path.

No ambiguous partial live dependency proceeds into M2.

Before M2 branches start, freeze the minimum contracts for:

- “I’m Lost” response.
- Grounded citation.
- Confusion event.
- Session handoff.
- Weak-area drill.
- SessionStore.

---

## 7. M2 — Must-Ship Vertical Slice, Days 6–10

### Goal

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

### Exit Gate

- The full deterministic callback passes in CI.
- A human completes the integrated demonstration by the end of Day 10.
- Grounding receives independent review.
- Findings are recorded for M3.

After this milestone, the complete deterministic callback becomes a required pull-request check.

### Miss Policy

If the callback is not demonstrable by the end of Day 10:

1. Cut M4 should-ship breadth.
2. Defer Live and durable-storage integration.
3. Use Days 11–15 to recover the simulated callback.
4. Preserve the Day-15 feature freeze.

---

## 8. M3 — Integration and Resilience, Days 11–13

### Work

- Fix findings from the Day-10 demonstration.
- Integrate the live adapter only if both required live spikes passed.
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

- The simulated runbook remains green.
- Any enabled live mode passes its human browser/audio checks.
- Core provider and application failures produce visible recoverable states.
- No persistence is enabled without its access-control and deletion gates.

### Miss Policy

If M3 is not complete by the end of Day 13:

1. Disable any unintegrated Live mode for the release candidate.
2. Use Days 14–15 for unresolved must-ship resilience.
3. Cut should-ship breadth rather than moving feature freeze.

---

## 9. M4 — Should-Ship Breadth, Days 14–15

Add only the highest-value work that does not destabilize the core callback:

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
- Verify the exact deployed and packaged commit.
- Finish submission text and artifacts.
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
    → companion handoff
    → weak-area drill
    → Day-10 demonstration
    → frozen release candidate

Real audio is a conditional adapter to this path. Its failure must not erase the demonstrable core product.

---

## 13. Risk Register

| Risk | Early trigger | Response |
|---|---|---|
| Tab capture or passthrough fails | M1 human capture check | Cut Live at Day 5; retain evidence and Simulation Mode |
| Scribe authentication or socket fails | M1 provider spike | Cut Live or timebox an approved proxy spike; never expose the permanent key |
| Reconnect duplicates or loses transcript | M1/M3 reconnect test | Preserve committed chunks, mint a new token, deduplicate by stable IDs |
| Grounded response cites irrelevant text | M2 evaluations | Reject invalid IDs, check claim support, default to not found |
| “I’m Lost” latency is unusable | M2 latency measurement | Reduce selected context, stream output, or choose a faster approved model |
| Confusion concept is too vague | M2 callback test | Constrain extraction to concepts supported by transcript evidence |
| Durable storage exposes sessions | M3 authorization test | Disable persistence and remain local/in-memory |
| Provider retains submitted audio/text | M1/M5 privacy preflight | Disclose the limitation; use synthetic or separately consented demo data |
| Coordinator becomes a bottleneck | More than two changes awaiting integration | Reduce active lanes and cut lower-priority work |

---

## 14. Cut Order

When behind, cut in this order:

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
- Honest source labeling and capture safety.
