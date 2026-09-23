# M01 — Repository & Tooling Guide

This document defines the development environment, monorepo architecture, tooling configurations, and operational workflows established in **Milestone M01** for the **Universal Business Operations SaaS** platform.

---

## 1. Repository Structure & Workspace Architecture

The project is structured as a unified monorepo managed by **pnpm workspaces**:

```
universal_saas/
├── apps/
│   ├── api/                     # Backend application (NestJS + TypeScript)
│   │   ├── src/                 # Application source code
│   │   ├── test/                # E2E & integration test suites
│   │   ├── eslint.config.mjs    # Flat ESLint configuration
│   │   ├── nest-cli.json        # NestJS CLI schema configuration
│   │   ├── package.json         # API package manifest & scripts
│   │   ├── tsconfig.json        # TypeScript configuration (extends base)
│   │   └── tsconfig.build.json  # Production compilation tsconfig
│   └── web/                     # Frontend application (Next.js 16 + React 19 + Tailwind v4)
│       ├── public/              # Static public assets
│       ├── src/                 # Next.js App Router source
│       ├── eslint.config.mjs    # Next.js Core Web Vitals ESLint config
│       ├── next.config.ts       # Next.js build & transpilation config
│       ├── package.json         # Web package manifest & scripts
│       ├── postcss.config.mjs   # PostCSS configuration
│       └── tsconfig.json        # Web TypeScript configuration (extends base)
├── packages/
│   ├── config/                  # Shared base configurations
│   │   ├── package.json         # Package manifest
│   │   └── tsconfig.base.json   # Strict TypeScript base configuration
│   ├── types/                   # Shared foundational types & DTO primitives
│   │   ├── src/index.ts         # Envelopes, pagination, common entity interfaces
│   │   ├── package.json         # Package manifest
│   │   └── tsconfig.json        # Typecheck configuration
│   └── ui/                      # Shared reusable UI component primitives
│       ├── src/
│       │   ├── button.tsx       # Accessible, typed Button primitive
│       │   └── index.ts         # UI barrel exports
│       ├── package.json         # Package manifest (peerDependencies for React)
│       └── tsconfig.json        # UI compilation & typecheck config
├── docs/                        # Architecture, PRD, and operational specifications
├── .editorconfig                # Universal indentation and charset rules
├── .env.example                 # Environment variables specification
├── .gitignore                   # Production-grade gitignore rules
├── .prettierrc                  # Monorepo code style configuration
├── .prettierignore              # Formatting ignore patterns
├── docker-compose.yml           # Local development service definitions
├── package.json                 # Monorepo root scripts & devDependencies
├── pnpm-lock.yaml               # Monorepo lockfile
└── pnpm-workspace.yaml          # Workspace package pattern definitions
```

---

## 2. Required Toolchain & Prerequisites

Ensure the following tools are installed on your workstation:

- **Node.js**: `>= 20.11.0` (LTS recommended, e.g. Node 22)
- **pnpm**: `11.x` (Corepack or standalone: `corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker & Docker Compose**: Docker Engine `>= 24.0` / Docker Desktop (for local PostgreSQL and Redis)
- **Git**: `>= 2.38`

---

## 3. Installation & Setup

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd universal_saas
   ```

2. **Install monorepo dependencies**:

   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env.local
   ```

---

## 4. Docker & Local Services

PostgreSQL and Redis are provided via `docker-compose.yml` for local development.

### Start Local Services

```bash
# Start PostgreSQL and Redis containers in detached mode
pnpm docker:up
# Or directly:
docker compose up -d
```

### Check Service Health & Logs

```bash
# View service logs
pnpm docker:logs

# Inspect running containers
docker compose ps
```

### Stop Services

```bash
pnpm docker:down
# Or to wipe local volume data if needed:
docker compose down -v
```

---

## 5. Development Workflows & Commands

All development commands are executable from the root of the monorepo:

| Command             | Action            | Description                                                                |
| :------------------ | :---------------- | :------------------------------------------------------------------------- |
| `pnpm dev`          | Start Development | Concurrently starts `apps/api` (NestJS watch) and `apps/web` (Next.js dev) |
| `pnpm build`        | Production Build  | Builds all packages and compiles production bundles for API and Web        |
| `pnpm lint`         | Lint Codebase     | Runs ESLint flat config across all apps and packages                       |
| `pnpm typecheck`    | Type Checking     | Executes `tsc --noEmit` across all workspace projects                      |
| `pnpm test`         | Run Test Suites   | Runs Jest unit tests across workspace projects                             |
| `pnpm format`       | Auto-format Code  | Formats all TS, TSX, JS, JSON, CSS, and Markdown files with Prettier       |
| `pnpm format:check` | Verify Formatting | Validates code style compliance in CI/CD pipelines                         |

### Workspace Filtering

Target specific applications or packages using pnpm filters:

```bash
# Run API dev server only
pnpm --filter api dev

# Run Web dev server only
pnpm --filter web dev

# Typecheck API only
pnpm --filter api typecheck

# Run API unit tests
pnpm --filter api test
```

---

## 6. TypeScript Architecture

The monorepo uses a shared base configuration located at [`packages/config/tsconfig.base.json`](file:///Users/revinr/Desktop/universal_saas/packages/config/tsconfig.base.json).

Key compiler guarantees:

- **Strict Mode Enabled**: `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`, `strictBindCallApply: true`.
- **Exhaustive Checks**: `noFallthroughCasesInSwitch: true`, `noImplicitReturns: true`.
- **Module Resolution**: `NodeNext` for backend services and type packages; `bundler` with `ESNext` for frontend Next.js applications.
- **Path Aliases**: Workspace package cross-referencing configured for immediate zero-build feedback loop.

---

## 7. Code Quality & Standards

- **ESLint**: Modern ESLint flat configuration (`eslint.config.mjs`) used across all packages.
  - Backend: `@typescript-eslint/recommendedTypeChecked` + `eslint-plugin-prettier`.
  - Frontend: `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript`.
- **Prettier**: Unified root rules (`.prettierrc`) enforcing 2-space indentation, double quotes, trailing commas, and LF line endings.
- **EditorConfig**: Ensures consistent behavior across VS Code, IntelliJ, Cursor, and Vim.

---

## 8. Troubleshooting

### Port Conflicts

- Default ports: API on `3001`, Web on `3000`, PostgreSQL on `5432`, Redis on `6379`.
- If port `5432` is already in use by a local Postgres service, update `docker-compose.yml` port mapping (e.g. `"5433:5432"`) and update `DATABASE_URL` in `.env`.

### Node Module Linking / Clean Reinstall

If pnpm workspace links become desynchronized:

```bash
# Clean build artifacts and reinstall
rm -rf node_modules apps/*/node_modules packages/*/node_modules dist .next
pnpm install
```
