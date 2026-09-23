# DOC-11: Engineering Coding Standards

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Rules for engineering quality and consistency.
**Owner:** Senior Software Architect

## Global Rules

- **TypeScript:** Strict mode everywhere. Do NOT bypass types with `any` unless extensively justified.
- **Secrets:** Never hardcode secrets. Use `.env` variables. Never commit `.env`.

## Frontend (React/Next.js)

- **Feature-Based Structure:** Code organized by domain features (`features/users/`, `features/auth/`).
- **No Business Logic in UI:** React components handle presentation. Data fetching uses TanStack Query.
- **State:** Use TanStack Query for server state. React state for local UI. Avoid global stores (Zustand) for server data.
- **API Clients:** All API calls use a centralized client.

## Backend (NestJS)

- **Controller Rule:** Must be thin. Receive request, validate DTO, call service, return response. No database queries here.
- **Service Rule:** Contains all business logic. Emits events where needed.
- **Repository Rule:** Handles Prisma/Database persistence.
- **Dependencies:** Features must remain independent. `Feature A` should not import internal files from `Feature B`.
