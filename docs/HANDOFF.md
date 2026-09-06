# LiveLecture AI — Current handoff

Verify this record against the repository and user instructions. It does not grant new spending or desktop permission.

- **Folder:** `C:\Users\abuiz\Documents\Codex\2026-09-04\CSCHackathon`
- **Branch:** `shared/livelecture`
- **Active AI:** none — Claude is next when the user starts its turn.
- **Last AI/task:** Codex, 2026-09-06; write the Claude/Gemini assignments and record the Gemini provider decision.
- **Starting shared head:** `48172a2b82e9615b4fc1b39217b37868ae006d09`. Read the current checkpoint with `git log -1 --oneline`; never reset to the historical starting hash.

## Claude's next task

Read [AI_ASSIGNMENTS.md](AI_ASSIGNMENTS.md), [TASK-103C](tasks/TASK-103C.md) and [ADR 0012](adr/0012-gemini-assistance-direction.md). Replace the inactive OpenAI assistance trial with Gemini, within the assigned private trial files. Verify current official Google model/pricing/privacy facts, adapt the transport and accounting, and run offline checks. Leave a committed IN REVIEW handoff for Gemini or Codex. Do not execute the old OpenAI trial, make provider calls, change transcription or add future features.

The user chose the provider and assigned the implementation; they have not approved API spending. The Gemini model and exact configuration remain for Claude to verify. Preserve the proposed ceiling of at most $1 total / 32 attempts, with $0 authorized. Keys remain local to the server process. The normal demo remains prewritten until a separately reviewed integration after real-model evidence.

## Gemini's following turn

Independently review Claude's exact migration, then follow the gated sequence in AI_ASSIGNMENTS.md: actual-model evidence with approval, remaining M3 learner/privacy/judge checks, and only then eligible M4 additions. Codex provides senior direction for material decisions. Do not skip a blocked gate or approve a fix you authored.

## What this turn changed

Coordination documents only: assignments, task contract, provider decision, current instructions/status and prominent notices that the old OpenAI runbook is historical. No provider code or model configuration was changed. Prior baseline: main `8cfa83b88c0f6186d3475266b005069da4fbe820`, with 303 ordinary tests and green CI recorded for the older preparation. Those results are not Gemini verification and were not rerun for these documents.

Checks for this documentation checkpoint: relative Markdown links, applicable formatting, local secret scan and diff whitespace. Actual results are in the checkpoint commit message. Always inspect `git status --short` before touching later dirty files. No services, original MeltingPot repositories, credentials or desktop surfaces were used this turn.

Before yielding, replace the active turn, actual changes/checks, unfinished work and next step here. Commit only scoped files when safe, otherwise list what remains dirty; set Active AI to none and stop before another AI starts.
