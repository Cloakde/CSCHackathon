# LiveLecture AI — Coordinator Task Board

**Authority:** This file is the temporary task tracker until GitHub Issues/Project access is verified for every participating model.

Only the Coordinator edits this file. Engineers request state changes in their handoffs.

## Temporary Default-Branch Policy

Until GitHub branch protection and required checks are confirmed, contributors may push only their assigned task branches. Only the Coordinator may update `main`, except that a Coordinator-authored change must be integrated by a temporary independent integrator after exact-commit approval and a green full repository check. Force-pushes to `main` are prohibited. This fallback policy remains active until the Coordinator records verified branch protection here.

| Task                              | Tier | State     | Owner      | Dependency                      | Owned scope                                            |
| --------------------------------- | ---: | --------- | ---------- | ------------------------------- | ------------------------------------------------------ |
| TASK-000 Canonical bootstrap      |    1 | IN REVIEW | Codex Lead | none                            | `bootstrap/TASK-000-canonical-scaffold` from `00af0dc` |
| TASK-101 Chrome capture spike     |    1 | TODO      | unassigned | TASK-000                        | Assigned in its future task contract                   |
| TASK-102 Scribe transport spike   |    1 | TODO      | unassigned | TASK-000                        | Assigned in its future task contract                   |
| TASK-201 Must-ship vertical slice |    1 | TODO      | unassigned | TASK-101 and TASK-102 decisions | Split into non-overlapping task contracts              |

Current TASK-000 review status:

- Clean lockfile installation and the complete repository check passed (56 tests plus all builds).
- Grounding/store and CI/extension red-team reviews approved the frozen working tree with no P1/P2 findings.
- The final approval must now bind to the exact submitted commit before independent integration.

Allowed states:

    TODO → READY → IN PROGRESS → IN REVIEW → MERGED

Additional states are **BLOCKED** and **CUT**. Review outcomes are **APPROVED** and **CHANGES REQUESTED**.
