# DOC-14: Deployment, Infrastructure & DevOps

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Document infrastructure, CI/CD, and environments.
**Owner:** DevOps Architect

## Infrastructure Architecture

- **Web App:** Next.js App (deployed via Docker/Container).
- **API:** NestJS REST API (deployed via Docker/Container).
- **Database:** PostgreSQL.
- **Cache/Queue:** Redis.
- **Storage:** S3-compatible Object Storage (AWS S3, MinIO, Cloudflare R2).

## Environments

- **Development:** Local setup via `docker-compose.yml`. Never use production DB for local dev.
- **Staging:** Pre-production environment mimicking production.
- **Production:** Live environment. Strict isolation from staging/dev.

## Deployment & DevOps rules

- **CI/CD:** GitHub Actions.
- **Database Migrations:** Version-controlled via Prisma (`prisma migrate deploy`). Never manually modify production schema.
- **Secrets:** Environment variables only. Actual secrets managed via secure Secret Manager.
- **Production Readiness:** Requires Security review, DB backup, Logging, Rate limiting, HTTPS/SSL, CORS configured.
