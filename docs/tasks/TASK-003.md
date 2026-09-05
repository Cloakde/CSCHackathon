# TASK-003 — Align Milestones with the MeltingPot Rework

**Tier:** 1 — coordinated change to the active plan and workflow

**State:** MERGED only when the independently approved, fully checked task revision reaches main; IN REVIEW until then

**Assigned engineer:** Codex Coordinator

**Independent reviewer:** `milestone_rework_review`

**Temporary independent integrator:** `milestone_rework_integrator`; not the author or reviewer

**Exact base commit:** `a7dc31e6aef64143486b170247b9d6dc5da930ba`

**Branch:** `coord/TASK-003-meltingpot-milestones`

**Timebox:** This planning update and its verification; no feature implementation

## Approved Objective

The Product Owner instructed **“Execute”** after the proposed milestone revision: retain the current M2 prototype and its pending acceptance checks, make M3 the connection to the separate MeltingPot rework copy, and defer broader redesign and M4 additions until the complete learning journey works. The extension remains the in-class interface; MeltingPot becomes the post-class destination.

## Owned Files

- `docs/MILESTONE_PLAN.md`
- `docs/MULTI_AGENT_WORKFLOW.md`
- `docs/TASK_BOARD.md` — Coordinator remains its sole writer
- `docs/adr/0007-meltingpot-rework-direction.md`
- `docs/tasks/TASK-003.md`

All other files and repositories are outside this task. Preserve original MeltingPot checkouts, remotes, deployments, databases, and source history. Do not edit historical TASK-201 or ADR 0006, implement the handoff, change providers, invent dates, authorize spending, or control the user's browser/desktop.

## Acceptance Criteria

- M0 stays complete. TASK-201–204 implementation remains merged; M2 human, actual AI, and judge-access evidence stays pending.
- M3's first build sequence is a reviewed handoff/access contract, private synthetic lecture review in the separate rework copy, then extension Finish/handoff and concept-specific practice with resolving citations.
- Preserve lecture, concept, confusion-event, and evidence identity across the journey. Personal lecture data must not automatically enter shared Pots or teacher reports.
- Preserve the current working M2 demo. Its existing localhost restrictions are not public authentication or an approved cross-app handoff.
- M3 retains recovery, reset/deletion, access-control, and conditional live checks. New storage or live services require their existing decisions and verification.
- M4 and broad MeltingPot redesign wait for the connected journey and its learner checks. Reuse suitable study components after checking that they preserve the privacy boundary.
- Plan, workflow, board, and direction ADR agree on priority, dependencies, and remaining proof. Existing milestone/task identifiers and provisional calendar status remain intact.
- No new feature task is marked assigned or ready without its own current base, owned paths, contract, and required decisions. Proposed TASK-301–303 are a sequence, not implementation authorization from this documentation task.

## Verification and Integration

- Check all five owned documents for consistency and run `git diff --check` and the repository formatter on applicable files.
- Run the full existing `npm run check` through pull-request CI, including production HTTP verification, and the full-history secret scan. The user's local demo keeps port 3000, so do not interrupt it to run a duplicate local server. No browser or paid provider is needed.
- Obtain independent approval of the exact task-head commit. A later commit requires renewed approval and checks.
- The temporary independent integrator alone may merge after verifying the approved head, successful checks, and the unchanged base or equivalent reviewed tree. Record the reviewed head, resulting main commit, and CI evidence in the integration handoff.

This task changes planning documents only. It does not complete M2 acceptance or M3 integration.
