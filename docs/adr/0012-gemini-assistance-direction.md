# ADR 0012 — Gemini for explanations and practice

**Status:** Product Owner direction accepted, 2026-09-06; migration assigned to Claude

The user explicitly chose Gemini after learning that the prepared trial used OpenAI's GPT-4.1 mini, then assigned Claude to make the correction. Use Google's Gemini API for the explanation and practice generation/verification trial. Do not execute the earlier OpenAI proposal or introduce an automatic OpenAI fallback. No provider implementation was changed when this direction was recorded.

This supersedes ADR 0010's provider selection and the executable OpenAI proposal in TASK-103B. Their existing controls remain requirements: bounded cost, durable accounting, safe cancellation, separate verification, source identity, protected credentials, synthetic input and honest evidence. Preserve the historical implementation/review record. TASK-103C defines the migration scope.

Claude must choose and document a concrete Gemini API/model configuration using current official Google documentation before adapting the implementation. The user selected the provider, not a specific model ID, pricing tier, retention policy, SDK, or reasoning setting. Record those facts rather than borrowing OpenAI-specific settings. Do not guess that one provider's privacy controls have equivalent meaning on another.

The previous $1/32-attempt proposal was never spending permission. Keep the proposed ceiling at or below $1 total and 32 attempts, with $0 currently authorized; recalculate conservative cost bounds for the selected Gemini configuration. No provider requests, including free-tier or token-counting requests, occur before the agreed data/credential/run authorization. Do not use a new policy or ledger ID to reset an existing allowance.

This direction covers text assistance and practice. Live audio/transcription remains a separate conditional decision; no Gemini transcription replacement, ElevenLabs removal, capture change, deployment, app activation or broader redesign is authorized here.
