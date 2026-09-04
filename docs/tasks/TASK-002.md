# TASK-002 — Prioritize the Learning Demo

**Tier:** 1 — coordinated change to the active plan and workflow

**State:** MERGED

**Assigned engineer:** Codex Coordinator

**Independent reviewer:** `plan_consistency_review` agent

**Temporary independent integrator:** `plan_integrator` agent; not the author or reviewer

**Exact base commit:** `ec8401bfcf3c512a4d3f5df94a163e302ddbe13c`

**Branch:** `coord/TASK-002-learning-first-plan`

**Timebox:** This documentation update and its review; no feature implementation

## Approved Objective

The Product Owner approved four changes: build the complete simulated learning experience earlier, test actual AI help early, strengthen the existing human demonstration with useful targeted practice, and confirm the judges' submission/access requirements before release work.

## Owned Files

- `docs/MILESTONE_PLAN.md`
- `docs/MULTI_AGENT_WORKFLOW.md`
- `docs/TASK_BOARD.md` — Coordinator remains its sole writer
- `docs/tasks/TASK-002.md`

All other paths are forbidden. Do not change application code, provider choices, existing spike contracts, security ADRs, activated calendar dates, or spending permissions. Record factual submission requirements from the competition link subsequently supplied by the Product Owner, including any conflicting published cutoff times, without inventing a resolved deadline.

## Acceptance Criteria

- M2 work starts after its own schedule, contract, and assignment gates; it does not depend on TASK-101 or TASK-102 decisions.
- Optional live work cannot displace core work or create overlapping file ownership.
- Early actual AI testing covers explanation, independent evidence checking, practice quality, response time, and a transcript that continues advancing.
- Scripted demonstration success is distinguished from measured real-AI success; neither calendar activation nor provider spending is invented.
- The existing human demonstration checks an uncoached learner's complete journey, answer feedback, and two distinct confusion concepts.
- Judge access and submission requirements are checked early and the chosen route is rehearsed at the first complete demo.
- Plan, workflow, and board agree; existing privacy, grounding, live preflight, and release safeguards remain enforceable.

## Verification and Integration

- Review the complete diff against the four approved changes and owned files.
- Run `npm run check` and `git diff --check` on the submitted revision.
- Obtain independent approval of the exact submitted commit.
- A temporary independent integrator is the sole merger of this Coordinator-authored change.
- Record reviewed and integrated commit evidence in the task board after integration.

No provider call, audio capture, or paid test is part of this task.

## Integration Result

Independent review approved `9df8479733fccddac7bd0c3a2d8c1ae1c6c20a31` without findings. The exact-head full repository check passed, including 56 tests and all builds. A temporary independent integrator fast-forwarded that same commit onto local and remote `main`. The Coordinator task board contains the detailed integration record and CI link. This follow-up record does not activate feature work or authorize provider spending.
