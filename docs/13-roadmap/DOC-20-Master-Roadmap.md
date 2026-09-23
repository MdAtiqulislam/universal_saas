# DOC-20: Product & Engineering Master Roadmap

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Outlines MVP, Post-MVP, and Future milestones.
**Owner:** Product Manager

## MVP Phase (Foundation)

- **M01 — Repository & Tooling:** pnpm monorepo setup, ESLint, TypeScript, Docker dev environment.
- **M02 — Database Foundation:** PostgreSQL, Prisma setup, base models (`organizations`, `users`).
- **M03 — Authentication:** JWT Auth, Argon2id, Login/Registration flows.
- **M04 — Organization Management:** Tenant CRUD, Tenant context resolution.
- **M05 — Membership & RBAC:** Roles, Permissions, `member_roles`.
- **M06 — User Management:** User CRUD within tenant limits.
- **M07 — Invitations:** Invite workflows, email verification foundation.
- **M08 — Notifications:** In-app notification bell and center.
- **M09 — File Management:** S3-compatible file storage abstraction.
- **M10 — Audit Logs:** Immutable audit trail for critical actions.
- **M11 — Settings:** Platform & Organization settings.
- **M12 — Dashboard:** Initial widgets (total users, active users, recent activity).

## POST-MVP Phase (Business Modules)

- **M13 — Business Module Foundation:** Generic domain structures.
- **M14 — Inventory:** Stock tracking, adjustments.
- **M15 — Warehouse:** Warehouse management (bins, racks).
- **M16 — Purchase:** Supplier management, POs.
- **M17 — Sales:** Customer management, sales orders.
- **M18 — Production:** Production logs, material consumption.
- **M19 — Shipment:** Dispatch and delivery logs.
- **M20 — Reports:** Data exports and analytics views.

## FUTURE Phase

- **M21 — SaaS Billing:** Subscription tiers, payments.
- **M22 — Production Hardening:** Row-Level Security, Advanced Caching.
- **M23 — Security Audit:** Third-party pen-testing.
- **M24 — Performance Optimization:** Elasticsearch integration if needed.
- **M25 — Production Deployment:** Final cutover.
