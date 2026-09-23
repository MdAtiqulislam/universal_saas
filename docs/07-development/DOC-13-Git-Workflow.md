# DOC-13: Git & Development Workflow

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Define repository, branching, and commit strategies.
**Owner:** DevOps Architect

## Repository Strategy

- **Monorepo:** pnpm workspaces.
- `apps/web` (Next.js), `apps/api` (NestJS).
- `packages/ui`, `packages/types`, `packages/config`.

## Branching & Pull Requests

- `main` (production), `develop` (staging).
- `feature/*`, `fix/*`.
- All code goes through Pull Requests with mandatory Code Review.

## Commit Convention

- Use **Conventional Commits**:
  - `feat:` new features (e.g., `feat: add organization management`)
  - `fix:` bug fixes (e.g., `fix: resolve login validation issue`)
  - `refactor:`, `test:`, `docs:`, `chore:`

## CI Checks

- Push -> Lint -> Type Check -> Unit Test -> Build -> E2E -> Deploy.
- CI pipeline required for all PRs.
