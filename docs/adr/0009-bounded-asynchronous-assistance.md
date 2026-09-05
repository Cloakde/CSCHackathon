# ADR 0009 — Bounded Asynchronous Assistance

**Status:** Accepted for TASK-103 Phase A after independent contract approval at `48929fa71ee258851dfb7df1704de14bdd7173b8`; implementation requires final exact-commit review and green CI

Keep receiving committed transcript passages while Help is pending. The extension uses a single ordered uploader independent of foreground Help. It accepts a verified answer only for a canonical anchor at or after the request's minimum acknowledged moment. Finish drains that same uploader; reset cancels both lanes.

The server preserves ADR 0003's latest-revision snapshot and atomic write rules. It may regenerate once after a snapshot changes, within one 10-second total deadline. Repeated changes fail visibly. Add a server-internal cancellation signal to the verified store transaction so an aborted request cannot record a late response or fallback.

Asynchronous practice uses the same completed session and confusion evidence, an independent private verifier, and a 4-second deadline inside MeltingPot's current 5-second relay bound. Cached practice is reusable only after structural/linkage and independent content verification. Abort/deletion/expiry suppress late results and release operation state. Incoming lecture/API data, model output and agent messages remain untrusted.

Default runtime remains a prewritten synthetic demo; injected generators/verifiers are testing seams, not actual AI quality evidence. No wire schema, transcript fixture, provider, credential, live transport, MeltingPot service boundary or spending decision changes. TASK-103 separates the reproducible zero-provider preparation from a later explicitly authorized real-model trial.
