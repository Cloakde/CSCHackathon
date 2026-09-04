# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                                         | Tier | State   | Owner             | Dependency                                                                               | Owned scope                                                                                                                           |
| -------------------------------------------- | ---: | ------- | ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-000 Canonical bootstrap                 |    1 | MERGED  | Codex Lead        | none                                                                                     | baseline `e4641e29`; CI run `33868115745`                                                                                             |
| TASK-001 Windows line-ending reproducibility |    1 | MERGED  | Codex Lead        | TASK-000                                                                                 | fix `d98343dd`; CI run `33869364979`                                                                                                  |
| TASK-002 Prioritize the learning demo        |    1 | MERGED  | Codex Coordinator | Product Owner approved plan changes                                                      | `docs/tasks/TASK-002.md`; reviewed/integrated `9df8479733fccddac7bd0c3a2d8c1ae1c6c20a31`; branch `coord/TASK-002-learning-first-plan` |
| TASK-101 Chrome capture spike                |    1 | BLOCKED | unassigned        | TASK-001 + schedule activation                                                           | `docs/tasks/TASK-101.md`                                                                                                              |
| TASK-102 Scribe transport spike              |    1 | BLOCKED | unassigned        | TASK-001 + schedule; spend for PASS                                                      | `docs/tasks/TASK-102.md`                                                                                                              |
| TASK-103 Actual AI help evaluation           |    1 | BLOCKED | unassigned        | Schedule + approved core contracts + assignment; separate capped spend for real evidence | Contract must be written before implementation; no paths reserved                                                                     |
| TASK-104 Judge requirements and access route |    3 | BLOCKED | Coordinator       | Source check complete; deadline conflict and chosen submission route remain unresolved   | Read-only findings below; no hosting/storage implementation authorized                                                                |
| TASK-201 Must-ship learning experience       |    1 | BLOCKED | unassigned        | Schedule + approved core contracts + assignment; no TASK-101/102 dependency              | Split into non-overlapping task contracts before implementation                                                                       |

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

TASK-002 integration record:

- Base: `ec8401bfcf3c512a4d3f5df94a163e302ddbe13c`; task branch: `coord/TASK-002-learning-first-plan`.
- Independent reviewer `plan_consistency_review` approved exact head `9df8479733fccddac7bd0c3a2d8c1ae1c6c20a31` with no findings across the four owned documentation files.
- Clean locked installation and the full repository check passed on that exact head: formatting, lint, local secret scanning, typechecks, all 56 tests, production builds, and packaged-extension verification. The worktree remained clean.
- Temporary independent integrator `plan_integrator` fast-forwarded the identical reviewed head onto local and remote `main`; the reviewed and integrated changes match. Existing worktrees were preserved.
- Integrated-head CI: [GitHub Actions run 33924868794](https://github.com/Cloakde/CSCHackathon/actions/runs/33924868794).
- This changes the plan and coordination records only. Calendar activation, feature assignments, actual AI evidence, and provider-spend authorization remain unresolved as recorded below.

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

| Required value                           | Current authoritative value                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Actual project Day 1 and timezone        | **UNSET — Product Owner required**                                                                                                                     |
| Submission deadline and timezone         | **CONFLICT — October 5, 2026: schedule says 12:00am PDT; rules text says 12:00pm Pacific. Final confirmation pending; do not rely on the later time.** |
| End-of-Day-5 live CONTINUE/CUT decision  | **UNSET — derive after Day 1 is fixed**                                                                                                                |
| Day-10 integrated demonstration          | **UNSET — derive and book after Day 1 is fixed**                                                                                                       |
| End-of-Day-15 feature freeze             | **UNSET — derive after Day 1 is fixed**                                                                                                                |
| End-of-Day-18 release candidate          | **UNSET — derive after Day 1 is fixed**                                                                                                                |
| Day-18 clean-environment rehearsal       | **UNSET — human window required**                                                                                                                      |
| Day-19 final rehearsal and packaging     | **UNSET — human window required**                                                                                                                      |
| Live capture/audio verification windows  | **UNSET — required for scheduled live work; NOT APPLICABLE only after an explicit Live CUT**                                                           |
| Learner demonstration participant/window | **UNSET — participant who did not build the app required**                                                                                             |
| Available engineering lanes              | **UNSET — Coordinator assignment required**                                                                                                            |
| Live feature classification              | **CONDITIONAL** under the accepted workflow; not promoted to Must Ship                                                                                 |
| Provider-spend authorization             | **$0 authorized for automated work; explicit capped smoke approval required**                                                                          |

## Evidence and Submission Decisions

| Required value                                                        | Current authoritative value                                                                                                                 |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Competition rules/source, checked date, judging criteria              | **CHECKED 2026-09-04 — official Devpost overview, rules, and schedule; findings below**                                                     |
| Submission artifacts, demo length, allowed disclosures                | **CHECKED — multiple evidence formats allowed; 1–2 minute video optional; AI-use disclosure required**                                      |
| Judge access route and related network/access constraints             | **SELECTION PENDING — website, demo, repository, screenshots, or video accepted; hosted app/extension installation not stated as required** |
| Actual AI evaluation owner/reviewer and frozen cases                  | **UNSET — TASK-103; Coordinator assignment required**                                                                                       |
| Actual AI response-time targets and capped provider-run authorization | **UNSET — no provider run authorized**                                                                                                      |
| Actual AI quality evidence                                            | **PENDING — no actual AI success established by bootstrap tests**                                                                           |
| Learner demonstration and two-concept practice evidence               | **PENDING — M2**                                                                                                                            |
| Judge access rehearsal                                                | **PENDING — first complete demonstration**                                                                                                  |
| Scripted-assistance submission scope acceptance                       | **NOT APPROVED — would require explicit Product Owner decision**                                                                            |

### TASK-104 Source Check — 2026-09-04

The Product Owner supplied the [CSC Back-to-School Devpost page](https://csc-back-to-school.devpost.com/). Its overview lists Learning, Design, Creativity, Functionality, and Impact as judging criteria. Submit a project title, problem and solution description, evidence showing the project, tools/resources used, AI-use disclosure, team names, and source/build/design files when available. A 1–2 minute video is optional; repository links, demos, screenshots, and websites are also accepted evidence. The posted requirements do not mandate a hosted app or judge-installed extension. The team still needs to select and rehearse its submission route; there is no reason to add hosting solely on an assumed requirement.

The [rules](https://csc-back-to-school.devpost.com/rules) require disclosure of pre-existing work and major outside resources, including AI contributions; teams must be able to explain their work. Award consideration involves a separate opt-in and a public/viewable project link; this source check does not opt the team in or accept promotional terms.

The [schedule](https://csc-back-to-school.devpost.com/details/dates) closes submissions at **October 5, 2026, 12:00am PDT**, also shown in the rules-page banner. The rules body instead states **12:00pm Pacific** that day. Record this as an unresolved official-source conflict, not a confirmed deadline or permission to use the later time. No rehearsal dates or working-day mapping have been inferred from it.

Until schedule activation is complete:

- TASK-101 and TASK-102 may be reviewed and assigned, but implementation may not start until the schedule gate is complete. TASK-102's fully stubbed implementation may proceed without spend after that point; only its provider smoke and PASS decision require separate spend authorization.
- TASK-103 and TASK-201 implementation also require schedule activation, approved contracts, and assignments. Their preparation may use synthetic data and fully injected providers; TASK-104's read-only requirements check may proceed.
- No ElevenLabs or generation-provider request, real audio transmission, credential use, or credit spend is authorized by this plan revision.
- Synthetic fixtures and fully stubbed tests remain the only permitted data/provider inputs.
- Simulation Mode remains the guaranteed product path and may never be silently presented as Live.

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
