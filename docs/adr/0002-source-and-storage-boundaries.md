# ADR 0002 — Transcript Source and Session Storage Boundaries

**Status:** Accepted for bootstrap

## Decision

Simulation and Live sources must emit the same validated event union. Downstream features depend on that union rather than a provider SDK.

Session data must be accessed through a SessionStore interface. Bootstrap provides an in-memory implementation contract only. Durable storage requires a later ADR covering deployment, authentication, per-session authorization, isolation, retention, and deletion.

## Consequences

- Simulation can remain a truthful, labeled demo path if Live is cut.
- Live transport can be replaced without rewriting learning features.
- A database is not allowed to block the Day-10 callback.
