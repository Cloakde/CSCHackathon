# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                                         | Tier | State   | Owner      | Dependency                          | Owned scope                               |
| -------------------------------------------- | ---: | ------- | ---------- | ----------------------------------- | ----------------------------------------- |
| TASK-000 Canonical bootstrap                 |    1 | MERGED  | Codex Lead | none                                | baseline `e4641e29`; CI run `33868115745` |
| TASK-001 Windows line-ending reproducibility |    1 | MERGED  | Codex Lead | TASK-000                            | fix `d98343dd`; CI run `33869364979`      |
| TASK-101 Chrome capture spike                |    1 | BLOCKED | unassigned | TASK-001 + schedule activation      | `docs/tasks/TASK-101.md`                  |
| TASK-102 Scribe transport spike              |    1 | BLOCKED | unassigned | TASK-001 + schedule; spend for PASS | `docs/tasks/TASK-102.md`                  |
| TASK-201 Must-ship vertical slice            |    1 | TODO    | unassigned | TASK-101 and TASK-102 decisions     | Split into non-overlapping task contracts |

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

## Schedule Activation Gate

M0 is complete, but non-bootstrap feature work remains blocked until the Product Owner and Coordinator record the calendar and human-test windows required by the accepted workflow. No contributor may infer these values from relative day numbers.

| Required value                          | Current authoritative value                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Actual project Day 1 and timezone       | **UNSET — Product Owner required**                                            |
| Submission deadline and timezone        | **UNSET — Product Owner required**                                            |
| End-of-Day-5 live CONTINUE/CUT decision | **UNSET — derive after Day 1 is fixed**                                       |
| Day-10 integrated demonstration         | **UNSET — derive and book after Day 1 is fixed**                              |
| End-of-Day-15 feature freeze            | **UNSET — derive after Day 1 is fixed**                                       |
| End-of-Day-18 release candidate         | **UNSET — derive after Day 1 is fixed**                                       |
| Day-18 clean-environment rehearsal      | **UNSET — human window required**                                             |
| Day-19 final rehearsal and packaging    | **UNSET — human window required**                                             |
| Chrome/audio verification windows       | **UNSET — human Windows/Chrome tester required**                              |
| Available engineering lanes             | **UNSET — Coordinator assignment required**                                   |
| Live feature classification             | **CONDITIONAL** under the accepted workflow; not promoted to Must Ship        |
| Provider-spend authorization            | **$0 authorized for automated work; explicit capped smoke approval required** |

Until this gate is complete:

- TASK-101 and TASK-102 may be reviewed and assigned, but implementation may not start until the schedule gate is complete. TASK-102's fully stubbed implementation may proceed without spend after that point; only its provider smoke and PASS decision require separate spend authorization.
- No ElevenLabs request, real audio transmission, credential use, or credit spend is authorized.
- Synthetic fixtures and fully stubbed tests remain the only permitted data/provider inputs.
- Simulation Mode remains the guaranteed product path and may never be silently presented as Live.

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
