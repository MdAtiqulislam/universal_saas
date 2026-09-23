# 16 — Security & Compliance Guide

## Multi-Tenant Security Threat Analysis

| Threat                            | Mitigation Architecture                                                                          | Invariant            |
| :-------------------------------- | :----------------------------------------------------------------------------------------------- | :------------------- |
| **Cross-Tenant Data Exposure**    | Direct query scoping with mandatory `organizationId` parameter on every repository call.         | `INV-478`            |
| **Privilege Escalation**          | `resolveAuthorizedProviders` filters providers by caller permissions before dispatching queries. | `INV-479`            |
| **SQL Injection**                 | Pure Prisma ORM parameterized queries; AST engine forbids raw SQL string evaluation.             | `INV-480`            |
| **Denial of Service (AST)**       | Max depth <= 5, max nodes <= 20, max value lengths <= 256 chars.                                 | `INV-482`, `INV-483` |
| **Private History Leakage**       | Search history queries filter on caller `userId`; other users' history is inaccessible.          | `INV-487`            |
| **Cross-Tenant View Sharing**     | `shareSavedView` actively verifies `targetId` belongs to the current tenant's active members.    | `INV-492`            |
| **Cache Poisoning / Escalation**  | Cache keys include tenant ID, caller permissions hash, and normalized query hash.                | `INV-498`            |
| **Restricted Telemetry Exposure** | Analytics telemetry redacts raw search query text, IP addresses, and user identifiers.           | `INV-499`            |
| **Admin Abuse**                   | Admin operations (reindexing, definition updates) require `search.admin` and record audit logs.  | `INV-500`            |
