# ADR 0001 — Bootstrap Stack

**Status:** Accepted for bootstrap

## Decision

- npm workspaces
- Node.js 24 for both local development and CI
- TypeScript 5.9
- Next.js companion web shell
- Vite-powered Manifest V3 extension shell
- Zod-first runtime schemas
- Vitest for deterministic tests
- In-memory session storage boundary during bootstrap

## Rationale

The stack supports one language across extension, backend, web, contracts, and tests. Bootstrap deliberately excludes paid provider calls, durable persistence, authentication, tab capture, and offscreen audio so those risks can be measured in isolated tasks.
