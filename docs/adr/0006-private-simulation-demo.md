# ADR 0006 — Private Local Simulation Demo

**Status:** Accepted for the TASK-201 integration transaction after independent exact-commit approval

The authorized first learning flow runs against a local server bound to `127.0.0.1:3000`, with explicit demo enablement. It accepts only the canonical synthetic lecture content. Session state and generated practice live in the existing in-memory SessionStore boundary or bounded ephemeral service records; restart/deletion removes application data. No audio or provider credentials are used.

Every API requires the nonsecret `X-LiveLecture-Demo: scripted-v1` header, a loopback Host, and any supplied Origin must be the exact loopback app origin or the configured extension origin. Browser requests from another website cannot pass preflight. Missing-Origin clients are inside the local-machine trust boundary. Apply strict body/size validation, rate and lifetime/session limits, no-store responses, and exact CORS. This is private-demo restriction, not public authentication, and must not be deployed as a shared service.

The extension receives only loopback host access and an exact loopback connect destination; it gains no capture permissions. Setup of its ID is a developer launch option. A browser rehearsal route reuses the extension's lecture component so the functional demo can be exercised without installing an extension; it is clearly identified as a rehearsal, not a verified Chrome installation.

All help uses the existing authoritative snapshot and verified build-and-record transaction. The deterministic demo generator recognizes two curated concepts, and a separately implemented exact-case/evidence verifier rejects unsupported content. This is prewritten assistance, explicitly labeled independently of simulated transcript playback. It does not prove actual AI generation quality.

Session IDs are fresh server identities, and fixture chunks are remapped only to that session. Lecture-relative timestamps remain unchanged; end time derives from server start plus the latest committed passage end, excluding partial text, to support accelerated playback. Handoff uses the existing server-validated path-only route; no content or credential is put in a URL.

The demo uploads complete passages before Help and Finish; arrivals during Help remain queued for the next operation. This is enough for the scripted callback, not proof of actual AI latency or continued-ingestion behavior. TASK-103 must test that separate requirement without weakening the grounding guarantees.

Future public deployment or actual generation requires separately reviewed provider, authorization, quota, retention, and spending decisions. ADR 0003's grounding guarantees are unchanged.
