# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                                         | Tier | State     | Owner             | Dependency                                                                               | Owned scope                                                                                                                                                   |
| -------------------------------------------- | ---: | --------- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-000 Canonical bootstrap                 |    1 | MERGED    | Codex Lead        | none                                                                                     | baseline `e4641e29`; CI run `33868115745`                                                                                                                     |
| TASK-001 Windows line-ending reproducibility |    1 | MERGED    | Codex Lead        | TASK-000                                                                                 | fix `d98343dd`; CI run `33869364979`                                                                                                                          |
| TASK-002 Prioritize the learning demo        |    1 | IN REVIEW | Codex Coordinator | Product Owner approved plan changes                                                      | `docs/tasks/TASK-002.md`; branch `coord/TASK-002-learning-first-plan`; base `ec8401bfcf3c512a4d3f5df94a163e302ddbe13c`; exact review head recorded in handoff |
| TASK-101 Chrome capture spike                |    1 | BLOCKED   | unassigned        | TASK-001 + schedule activation                                                           | `docs/tasks/TASK-101.md`                                                                                                                                      |
| TASK-102 Scribe transport spike              |    1 | BLOCKED   | unassigned        | TASK-001 + schedule; spend for PASS                                                      | `docs/tasks/TASK-102.md`                                                                                                                                      |
| TASK-103 Actual AI help evaluation           |    1 | BLOCKED   | unassigned        | Schedule + approved core contracts + assignment; separate capped spend for real evidence | Contract must be written before implementation; no paths reserved                                                                                             |
| TASK-104 Judge requirements and access route |    3 | TODO      | Coordinator       | Official competition requirements and Product Owner confirmation                         | Read-only requirements check; Coordinator records findings here; no hosting/storage implementation authorized                                                 |
| TASK-201 Must-ship learning experience       |    1 | BLOCKED   | unassigned        | Schedule + approved core contracts + assignment; no TASK-101/102 dependency              | Split into non-overlapping task contracts before implementation                                                                                               |

TASK-000 integration record:

- Clean lockfile installation and the complete repository check passed (56 tests plus all builds).
- Three independent reviews approved exact head `e4641e29c804905576ef095cb340c6b26e82fa76` with no P1/P2 findings.
- A temporary independent integrator fast-forwarded the identical reviewed commit to `main`.
- [GitHub Actions run 33868115745](https://github.com/Cloakde/CSCHackathon/actions/runs/33868115745) passed repository verification and full-history secret scanning on the integrated commit.

TASK-001 integration record:

- A fresh Windows checkout reproduced a false Prettier failure because Git converted LF blobs to CRLF while the formatter requires LF.
- The exact `.gitattributes` fix passed a clean-install full check in a newly created Windows worktree, including all 56 tests and builds.
- Three independent reviewers approved exact commit `d98343dd6f7b11bd0f0d5eebb6affc8ebae0882b`, and an independent integrator fast-forwarded it to `main`.
- [GitHub Actions run 33869364979](https://github.com/Cloakde/CSCHackathon/actions/runs/33869364979) passed both required jobs on the integrated commit.

## Approved Delivery Priorities

- The next main implementation milestone is M2's complete simulated learning experience, starting during Days 3–5 after its own gates; it does not wait for live-audio PASS/CUT decisions.
- The Coordinator must assign core engineers and reviewers first. TASK-101/TASK-102 are optional parallel work only with available capacity and exclusive ownership. TASK-101 currently overlaps core extension UI files, and TASK-102's shared export is a serialized hotspot; sequence or amend these boundaries before assignment.
- TASK-103 receives an owner, reviewer, synthetic evaluation set, expected evidence/answers, response-time targets, and capped-run contract early. Test actual help and practice while the transcript keeps advancing. $0 preparation uses injected providers; actual provider evidence requires separate authorization.
- TASK-104 records official requirements/source/date, judging criteria, demo length, required artifacts, allowed simulation/AI disclosures, and how judges will access the project. Resolve relevant requirements before hosting/storage/distribution choices and rehearse the chosen route at the first complete demonstration.
- By the first complete demo, no later than Day 10, a non-builder must complete the help-to-practice journey without coaching. Use two distinct confusion concepts, correct questions/answers/explanations, and the confirmed judge access route.
- Track functional checks, learner demonstration, actual AI quality, and judge access separately. Scripted assistance must be disclosed separately from simulated transcripts; a scripted submission scope requires explicit Product Owner acceptance.

New task contracts must record an exact current reviewed base and exclusive paths before assignment. TASK-101/TASK-102 retain their existing recorded base until the Coordinator explicitly refreshes their contracts; do not silently branch from a different commit or use a pre-revision plan to restore the old sequencing.

## Schedule Activation Gate

M0 is complete, but non-bootstrap feature work remains blocked until the Product Owner and Coordinator record the calendar and human-test windows required by the accepted workflow. No contributor may infer these values from relative day numbers.

| Required value                           | Current authoritative value                                                                  |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| Actual project Day 1 and timezone        | **UNSET — Product Owner required**                                                           |
| Submission deadline and timezone         | **UNSET — Product Owner required**                                                           |
| End-of-Day-5 live CONTINUE/CUT decision  | **UNSET — derive after Day 1 is fixed**                                                      |
| Day-10 integrated demonstration          | **UNSET — derive and book after Day 1 is fixed**                                             |
| End-of-Day-15 feature freeze             | **UNSET — derive after Day 1 is fixed**                                                      |
| End-of-Day-18 release candidate          | **UNSET — derive after Day 1 is fixed**                                                      |
| Day-18 clean-environment rehearsal       | **UNSET — human window required**                                                            |
| Day-19 final rehearsal and packaging     | **UNSET — human window required**                                                            |
| Live capture/audio verification windows  | **UNSET — required for scheduled live work; NOT APPLICABLE only after an explicit Live CUT** |
| Learner demonstration participant/window | **UNSET — participant who did not build the app required**                                   |
| Available engineering lanes              | **UNSET — Coordinator assignment required**                                                  |
| Live feature classification              | **CONDITIONAL** under the accepted workflow; not promoted to Must Ship                       |
| Provider-spend authorization             | **$0 authorized for automated work; explicit capped smoke approval required**                |

## Evidence and Submission Decisions

| Required value                                                        | Current authoritative value                                       |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Competition rules/source, checked date, judging criteria              | **UNSET — TASK-104**                                              |
| Submission artifacts, demo length, allowed disclosures                | **UNSET — TASK-104**                                              |
| Judge access route and related network/access constraints             | **UNSET — TASK-104; resolve before dependent setup choices**      |
| Actual AI evaluation owner/reviewer and frozen cases                  | **UNSET — TASK-103; Coordinator assignment required**             |
| Actual AI response-time targets and capped provider-run authorization | **UNSET — no provider run authorized**                            |
| Actual AI quality evidence                                            | **PENDING — no actual AI success established by bootstrap tests** |
| Learner demonstration and two-concept practice evidence               | **PENDING — M2**                                                  |
| Judge access rehearsal                                                | **PENDING — first complete demonstration**                        |
| Scripted-assistance submission scope acceptance                       | **NOT APPROVED — would require explicit Product Owner decision**  |

Until schedule activation is complete:

- TASK-101 and TASK-102 may be reviewed and assigned, but implementation may not start until the schedule gate is complete. TASK-102's fully stubbed implementation may proceed without spend after that point; only its provider smoke and PASS decision require separate spend authorization.
- TASK-103 and TASK-201 implementation also require schedule activation, approved contracts, and assignments. Their preparation may use synthetic data and fully injected providers; TASK-104's read-only requirements check may proceed.
- No ElevenLabs or generation-provider request, real audio transmission, credential use, or credit spend is authorized by this plan revision.
- Synthetic fixtures and fully stubbed tests remain the only permitted data/provider inputs.
- Simulation Mode remains the guaranteed product path and may never be silently presented as Live.

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
