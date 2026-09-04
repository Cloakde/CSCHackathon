# TASK-001 — Windows Line-Ending Reproducibility

**Tier:** 1

**State:** MERGED

**Assigned engineer:** Codex Lead

**Base commit:** e4641e29c804905576ef095cb340c6b26e82fa76

## Objective

Make a fresh Windows checkout satisfy the same formatting gate as Linux CI by preventing Git's `core.autocrlf` setting from rewriting repository text files to CRLF when Prettier requires LF.

## Owned Paths

- `.gitattributes`
- `docs/TASK_BOARD.md`
- `docs/tasks/TASK-000.md`
- `docs/tasks/TASK-001.md`

## Requirements

- Repository text files check out with LF on every platform.
- Windows command scripts retain CRLF where required.
- Common binary assets are never line-ending normalized.
- The fix must not change existing tracked file blobs merely to disguise checkout conversion.
- Verification must include a newly created Windows worktree from the exact submitted commit.

## Acceptance Criteria

- A fresh Windows worktree created from the submitted commit has LF-only `README.md` and ADR files.
- `git status --porcelain` is empty immediately after checkout and after the full repository check.
- `npm ci --no-audit --no-fund` succeeds in the fresh worktree.
- `npm run check` passes all formatting, lint, secret-scan, typecheck, test, build, and extension-package gates.
- `git diff --check origin/main...HEAD` passes.
- Independent review binds to the exact submitted commit before integration.

## Required Review

Independent Tier 1 review is required because this changes repository-wide checkout behavior and the canonical verification path.

## Verification Handoff

TASK-001 is **MERGED**.

Fresh Windows worktree verification against the code-identical pre-handoff commit `569b242b4d058d4ce9cffd2649d50116c5c37276` passed:

- `README.md` and all three ADR files contained zero CRLF sequences before any formatter ran.
- The full repository Prettier check passed before dependency installation or file rewriting.
- `npm ci --no-audit --no-fund` installed the committed lockfile successfully.
- `npm run check` passed formatting, zero-warning lint, local secret scan, all workspace typechecks, 56 tests, all production builds, and packaged-extension verification.
- `git status --porcelain` remained empty before and after verification.

Exact submitted commit `d98343dd6f7b11bd0f0d5eebb6affc8ebae0882b` was then checked out into another new Windows worktree with `core.autocrlf=true`. All 67 tracked files contained no unexpected CRLF, the worktree remained clean, and the clean install plus complete 56-test/build gate passed again.

- Three independent exact-commit reviews approved `d98343dd6f7b11bd0f0d5eebb6affc8ebae0882b` with no P1/P2 findings.
- A temporary independent integrator fast-forwarded the exact reviewed commit onto `main` without modifying the diff.
- [GitHub Actions run 33869364979](https://github.com/Cloakde/CSCHackathon/actions/runs/33869364979) passed both repository verification and full-history Gitleaks scanning on the integrated commit.
