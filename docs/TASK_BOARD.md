# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                                         | Tier | State  | Owner      | Dependency                      | Owned scope                               |
| -------------------------------------------- | ---: | ------ | ---------- | ------------------------------- | ----------------------------------------- |
| TASK-000 Canonical bootstrap                 |    1 | MERGED | Codex Lead | none                            | baseline `e4641e29`; CI run `33868115745` |
| TASK-001 Windows line-ending reproducibility |    1 | MERGED | Codex Lead | TASK-000                        | fix `d98343dd`; CI run `33869364979`      |
| TASK-101 Chrome capture spike                |    1 | TODO   | unassigned | TASK-001                        | Assigned in its future task contract      |
| TASK-102 Scribe transport spike              |    1 | TODO   | unassigned | TASK-001                        | Assigned in its future task contract      |
| TASK-201 Must-ship vertical slice            |    1 | TODO   | unassigned | TASK-101 and TASK-102 decisions | Split into non-overlapping task contracts |

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

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
