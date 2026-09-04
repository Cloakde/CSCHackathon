# TASK-000 — Canonical Bootstrap

**Tier:** 1

**State:** IN REVIEW

**Assigned engineer:** Codex Lead

**Timebox:** Six hours

**Base commit:** 00af0dc5becb8b69fb358c48c76f0f19692d922b

## Objective

Create one honest, buildable, testable baseline on a branch based on current main. Salvage only useful concepts from the orphan experimental scaffold; do not merge it wholesale.

## Owned Paths

- Root workspace configuration and lockfile
- AGENTS.md and README.md
- .github/workflows/**
- shared/**
- extension/**
- web/**
- docs/TASK_BOARD.md
- docs/tasks/TASK-000.md
- docs/adr/**

## Forbidden Paths

- docs/MULTI_AGENT_WORKFLOW.md
- docs/MILESTONE_PLAN.md
- Any other repository or checkout

## Requirements

- npm workspace with pinned package manager and Node floor
- Buildable web, extension, and shared packages
- Zod-first schemas with inferred TypeScript types
- Deterministic synthetic fixture with cross-reference validation
- Server-derived grounding snapshots bound to an exact transcript revision and committed time window
- Server-owned citation hydration and a fixed insufficient-evidence fallback
- Independent semantic evidence-verifier contract that fails closed unless every material claim is supported
- One public verified build-and-record transaction with context-validated atomic response/confusion persistence, stale-context rejection, and exact-command retry coalescing
- Simulation source with reset, pause, speed, Stop, and persistent labeling
- Minimal side-panel transcript UI
- Real format, lint, typecheck, test, and build commands
- Deterministic fixture-to-UI smoke test
- CI with a verified full-history Gitleaks scan, plus the local content scan
- Honest README

## Acceptance Criteria

- Clean install succeeds from the lockfile.
- Root format, lint, typecheck, test, and build commands are real and green.
- Fixture and expected scenarios parse through runtime schemas.
- Negative tests reject bad time ranges, cross-session citations, and broken weak-area links.
- Clients cannot choose a grounding anchor; snapshots come from the latest fully committed server transcript revision.
- Model citations are hydrated only from the exact server-owned snapshot.
- Every grounded diagnosis and concept claim requires an independent supported verdict; unsupported, invalid, and failed verification use a fixed server-authored fallback with no citations.
- The returned assistance response and confusion event are bound to one validated snapshot; stale contexts cannot be persisted.
- Extension and web artifacts build.
- A post-build verifier checks the packaged extension manifest, referenced artifacts, least-privilege permissions, and background-worker startup wiring.
- UI smoke test asserts deterministic committed transcript rendering.
- Simulation Mode is always visibly labeled.
- No provider calls, credentials, real audio, participant data, or silent fallback exist.
- CI scans every reachable Git commit for secrets using a checksum-verified, pinned Gitleaks release.
- Independent review is bound to the exact final commit.

## Required Review

Independent Tier 1 review is required before integration.

## Verification Handoff

TASK-000 is frozen for **IN REVIEW** after the following clean-install verification:

- `npm ci --no-audit --no-fund` completed from the committed lockfile.
- `npm run check` passed formatting, zero-warning lint, local secret scan, all workspace typechecks, all tests, and all production builds.
- Tests passed: shared 5 files / 47 tests, web 1 file / 1 test, extension 2 files / 8 tests (56 total).
- The post-build verifier passed against the packaged MV3 extension, including Chrome 116 minimum version, side-panel-only permission, no host permissions, local packaged assets, and background-worker startup wiring.
- The companion landing page and served side panel were visually inspected. Simulation Mode remained visibly labeled, and no obvious overlap or accessibility-tree defect was found.
- An independent grounding/store red-team review approved the authoritative snapshot, verifier, fallback, atomic persistence, runtime state isolation, identity reservation, retry, race, and temporal boundaries with no P1/P2 findings.
- An independent CI/extension red-team review approved the Node/toolchain alignment, full-history Gitleaks job, packaged manifest checks, and extension behavior with no P1/P2 findings.
- GitHub branch protection could not be confirmed through the available access, so the explicit temporary default-branch policy in `docs/TASK_BOARD.md` is active.
- `git diff --check` passed.

Remaining integration gates:

- Independent review must bind its approval to the exact submitted commit.
- Loading the unpacked extension in desktop Chrome is not reproducible from the current in-app browser surface and remains a reviewer/manual check.
- Calendar activation and Product Owner cut-line ratification remain pre-feature coordination tasks rather than hidden bootstrap assumptions. Branch-protection confirmation may replace, but does not silently suspend, the active temporary default-branch policy.
