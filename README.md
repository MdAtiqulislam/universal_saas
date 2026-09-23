# Universal SaaS

A TypeScript monorepo for a multi-tenant SaaS (ERP-style) platform — NestJS API, Next.js web app and shared packages, with an extensive docs library.

## Modules

- `apps/api` — NestJS backend (accounting, inventory, sales, HR/payroll, manufacturing, CRM, billing, notifications, workflows and more; Prisma migrations + seed)
- `apps/web` — Next.js frontend (dashboards per domain: accounting, billing, CRM, warehouse, shipping, analytics, operations)
- `packages/*` — shared config, types and UI
- `docs/` — requirements, architecture, ADRs and milestone implementation reports

## Tech Stack

- pnpm workspaces + Turbo
- NestJS + Prisma (PostgreSQL), Next.js + React
- Docker Compose for local services

## Getting Started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env   # then fill in secrets (never commit .env)
docker compose up -d
pnpm --filter api prisma:migrate
pnpm dev
```

## Notes

- `node_modules`, build output and **all `.env` files are ignored** by `.gitignore`.
- No secrets are committed to this repository.
