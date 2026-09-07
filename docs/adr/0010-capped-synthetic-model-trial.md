# ADR 0010 — Capped synthetic model trial

**Status:** Accepted for inactive TASK-103 Phase B preparation; paid execution remains pending

**2026-09-06 update:** [ADR 0012](0012-gemini-assistance-direction.md) supersedes the OpenAI provider selection below. Claude is assigned to migrate to Gemini under TASK-103C. Preserve the accounting, validation and evidence requirements; do not execute the historical OpenAI proposal.

Prepare an explicitly invoked server-only trial using the pinned `gpt-4.1-mini-2025-04-14` snapshot and separate generation/verification calls. The existing application remains a prewritten synthetic demo until actual-model evidence and a later product integration decision justify changing it.

The proposed allowance is $1 total and 32 attempts. A durable exclusive ledger reserves the published full-context input cost plus configured maximum output before every call, then releases unused allowance only for validated usage. Unknown failures retain the reservation. All worktrees share one fixed allowance. No credentials or paid execution are authorized merely by preparing this adapter.

Four frozen cases and real-clock extension/dispatcher ingestion probes preserve current deadlines and grounding guarantees. Reports separate structural validity, verifier results, real latency and human mathematical review. No expected answers enter generation or verification prompts. Keep recording-free synthetic data, explicit nonzero provider retention disclosure, and the existing simulation path. TASK-103B records current official sources, precise interfaces, ownership and execution gates.
