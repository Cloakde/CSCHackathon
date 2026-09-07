# ADR 0011 — AIs take turns on one shared branch

**Status:** Accepted by direct Product Owner instruction, 2026-09-06

The Product Owner wants to switch between AIs to make better use of available usage, with one AI working at a time. Separate task/model branches and worktrees add unnecessary handoff and integration work for that arrangement.

Use the existing primary checkout at `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon` and the persistent branch `shared/livelecture`, created from verified clean main `8cfa83b88c0f6186d3475266b005069da4fbe820`. All AIs continue there sequentially. Do not start concurrent AI engineers or reviewers. The user selects the active AI; that AI maintains the task board and a short `docs/HANDOFF.md`, then releases the turn.

`shared/livelecture` contains ongoing work. `main` remains the reviewed, tested baseline. Reviews happen on a later AI's turn and remain independent of the implementation author. Promotion still needs the applicable checks and approval; sharing a branch does not mark unfinished work complete. Preserve the persistent shared branch when promoting it.

This decision supersedes old requirements for a separate branch/worktree per task or model and for parallel engineering lanes, including in historical contracts. Preserve dirty files, check the actual current state, and avoid repeating completed work just because the active model changed.

## Branch cleanup amendment — 2026-09-06

The Product Owner subsequently requested exactly one branch besides `main`, with no progress lost. Keep only `main` and `shared/livelecture` locally and on origin. This supersedes the earlier instruction to retain old branch names. Do not recreate task/model branches or create additional worktrees during sequential development.

Before deleting the old names, Codex saved every branch tip and its complete reachable history in a Git bundle, restored it into a separate bare repository, and verified its objects. Custom archive refs also retain the old tips in the primary repository without adding branches. All 17 worktrees were clean; the 16 old task folders were detached at their existing commits, with tracked contents and indexes verified unchanged. No folder was removed, and historical model branches were not merged wholesale. Counts, original hashes, backup location and recovery instructions are in [BRANCH_ARCHIVE.md](../BRANCH_ARCHIVE.md).

This is a coordination change only. It does not approve provider spending, credential use, desktop control, live audio, deployment, extra features, or changes to either original MeltingPot repository. The isolated MeltingPot copy remains a separate repository with its own boundaries; it is not combined with LiveLecture merely by adopting a shared branch.
