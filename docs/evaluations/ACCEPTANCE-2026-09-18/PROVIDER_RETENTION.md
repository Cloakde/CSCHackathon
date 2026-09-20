# Provider data and retention — checked September 18, 2026

This satisfies M5's requirement to record provider settings and limitations; it does not accept provider retention for real classroom use. Source inspected: primary `1d54004d07cbee0d4de47a3c96260e7c7c490aeb`, whose runtime is unchanged from the tested `7ba8880`, and isolated copy `d6bb1f9`. This public-documentation/source review made no provider request, read no credential and changed no account setting.

## Gemini text assistance

The server sends bounded lecture passages/context and candidate explanation/practice text for generation and verification. It uses direct `generateContent` with `gemini-3.1-flash-lite` and `store:false`. No audio, uploaded files, explicit cached-content reference, Search/Maps grounding, tools or Interactions conversation storage is used. Source: `web/src/server/ai-evaluation/trial/policy.ts` and `web/src/server/assistance/provider-trial/transport.ts`.

Google documents `store` as a request-level logging override. Generate Content defaults to no request storage; the explicit flag also overrides project-level logging. This describes ordinary project logging, not every provider-held copy. [API reference](https://ai.google.dev/api/generate-content), [logging guide](https://ai.google.dev/gemini-api/docs/logs-datasets).

Google's abuse-monitoring policy separately states **55 days** of retention for prompts, contextual information and responses, with access by authorized staff for flagged-content review. `store:false` does not justify an immediate-deletion or zero-retention claim. This corrects the historical ADR report's description of the period as undisclosed. [Abuse-monitoring policy](https://ai.google.dev/gemini-api/docs/usage-policies).

Paid-service data is not used to improve Google's products under the cited terms. Gemini API paid-service status depends on the **API's Cloud project having active billing**, not simply a working key or a ChatGPT subscription. Unpaid-service terms permit product improvement and human review, with the stated EEA/Switzerland/UK exception. **This project's actual billing status and sharing choices were not verified.** Charging our local allowance at published paid rates is conservative accounting, not proof of billing tier or an invoice. [Current Gemini terms](https://ai.google.dev/gemini-api/terms).

Google also documents project-isolated implicit RAM caching with a 24-hour TTL. We do not request explicit caching, but that omission does not prove that implicit caching is absent. Separate optional project logs/datasets can have their own storage/sharing settings; uploaded or shared datasets are not part of this implementation. [Retention guide](https://ai.google.dev/gemini-api/docs/zdr), [logging/sharing policy](https://ai.google.dev/gemini-api/docs/logs-policy).

## ElevenLabs live transcription

The opt-in transport sends transient synthetic PCM during the authorized test and requests `enable_logging=false`. Its permanent key stays server-side; the extension receives a short-lived token. Source: `extension/src/transcription/scribe-transport.ts`.

ElevenLabs ties zero-retention availability to account eligibility. Its parameter description says enterprise; its warning example mentions enterprise or trial. The same reference says the warning means zero retention was not applied and logging continues. That documentation does **not** prove this account qualifies. Both connections in our recorded test reported `RETENTION_ACTIVE`. The integrated extension stops capture/transcription on the warning; the earlier transport-only PASS is not a live-privacy PASS. [Realtime reference](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime), [observed test and stop behavior](README.md).

The applicable account retention duration, account-level training/sharing settings and deletion behavior remain **unverified**. No claim of zero retention or confirmed provider deletion is made. Resolving eligibility/settings requires account-specific evidence; this record neither upgrades a plan nor weakens the stop-on-warning rule.

## Effect on the delivered demo

The ordinary package uses the synthetic transcript and prewritten help, so neither provider receives lecture content through that path. The separate bounded provider runs also used only synthetic material; all spending claims remain closed. The recording preview discloses its prewritten assistance.

Deleting a local lecture clears the application's session, not provider records, already downloaded study files or deliberately preserved synthetic test evidence. The existing release guide explains the local in-memory/page/file boundaries. Before real classroom material or broader public access is considered, the account's applicable data terms/settings and the resulting user disclosure need review. No real-classroom use, new paid test, provider migration or public release follows from this documentation correction.

## Verification

Sequential independent review checked the cited public sources and current request/stop behavior and found no actionable P1/P2. Scoped Markdown formatting and `git diff --check` passed. This closes the documentation gap only; it does not verify account settings, erase provider records or accept a production privacy guarantee.
