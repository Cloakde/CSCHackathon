# LiveLecture AI Agent Instructions

## Current working mode: one shared branch, one AI at a time

The Product Owner changed the collaboration model on 2026-09-06 to switch between AIs as usage allows. All AIs use **`shared/livelecture`** in **`C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon`**. Do not create a branch/worktree per AI or resume work from the older task worktrees. Do not launch parallel AI workers or reviewers unless the user explicitly changes this preference.

This instruction supersedes older per-model/per-task branch and concurrent-lane requirements, including those in historical task contracts. The only branches are **`main` and `shared/livelecture`**, locally and on origin. The user-requested cleanup archived the old branches' complete history before deleting their names; old worktree folders remain detached reference copies. Do not recreate those branches or resume work in those folders. See [the archive and recovery record](docs/BRANCH_ARCHIVE.md). `main` remains the reviewed baseline; review and checks are still required to promote work there.

Before working in this repository:

1. Read [docs/HANDOFF.md](docs/HANDOFF.md) and [docs/TASK_BOARD.md](docs/TASK_BOARD.md).
2. Read the assigned task contract and relevant ADRs; consult the relevant sections of [docs/MULTI_AGENT_WORKFLOW.md](docs/MULTI_AGENT_WORKFLOW.md) and [docs/MILESTONE_PLAN.md](docs/MILESTONE_PLAN.md). Use the handoff to avoid rereading unrelated history or repeating completed work.
3. Check the folder, branch, latest commit and dirty files. Preserve unfinished work; never reset, clean or overwrite it to obtain a clean checkout.
4. Confirm the user has handed you the turn, then record your active task and scoped files in the handoff. If another AI is still active, wait for its handoff.

Before yielding, update the handoff with what changed, actual checks, unfinished work and the next step. Commit only scoped work when safe; otherwise list the dirty files and explain them. Release the active turn. The next AI continues in this same folder and branch.

Do not self-assign tasks, modify unowned paths, expose credentials, use real classroom data in tests, or present Simulation Mode as live capture.

The AI holding the turn maintains the task board and handoff on behalf of the Coordinator. Switching AIs does not require a new task or redoing completed checks. Independent review can happen on a later AI's turn; no AI approves or merges its own implementation.

## Current assignments

**Latest turn (2026-09-06):** the user assigned Codex to fix the reviewed submission. Follow the current handoff and TASK-304 evidence for the correction, then use a later independent reviewer for Codex-authored changes. Do not repeat Gemini's historical twelve-feature list or restore its deferred additions wholesale. The original twelve-step offline queue and all provider/desktop/M4 gates still apply.

The Product Owner assigned **Claude to replace the inactive OpenAI assistance trial with Gemini**, then **Gemini to continue the eligible milestones**, with **Codex providing senior direction and review**. Read [docs/AI_ASSIGNMENTS.md](docs/AI_ASSIGNMENTS.md) for scope and order. Claude's bounded implementation contract is [TASK-103C](docs/tasks/TASK-103C.md). The Gemini provider decision is recorded in [ADR 0012](docs/adr/0012-gemini-assistance-direction.md).

**Current user direction (2026-09-06): no API testing yet.** Gemini's next assignment is the 12-step [offline queue in TASK-304](docs/tasks/TASK-304.md): review Claude, correct scoped defects, strengthen the existing simulated journey and prepare later checks. Provider testing is deliberately deferred; do not ask for keys/spend or run free-tier/connectivity/token-count tests to continue. Complete independent offline steps, then hand off to Codex. M4 features and human/provider acceptance remain gated.

Do not execute the old OpenAI trial. Choosing Gemini for explanations and practice does not change the separately planned transcription provider, authorize API traffic/spending, or remove the milestone gates. Ask Codex to resolve a material scope or architecture change; ask the user only for their required decisions, spending or session permissions. Keep user-facing updates short and in plain language.
