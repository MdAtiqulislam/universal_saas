# Milestone M44: Unified Search, Discovery & Saved Views Foundation

## Overview

Milestone M44 establishes an enterprise-grade, multi-tenant **Unified Search, Discovery & Saved Views Platform** for the Universal Business Operations SaaS. It provides seamless cross-domain discovery across 11 business modules (CRM, Sales, Inventory, Warehouse, Quality, Returns, Service, Finance, Workflows, Notifications, Team) using a PostgreSQL-first architecture with deterministic relevance ranking, declarative AST query filters, and omnichannel search alerting.

## Core Capabilities

1. **Modular Domain Providers**: 11 domain adapters encapsulating Prisma queries, tenant isolation, and RBAC permission gating.
2. **Deterministic Relevance Ranking**: Multi-tier scoring (exact ID, title, prefix, token matches, recency) with stable tie-breaking.
3. **Declarative Filter AST Engine**: Zero `eval()`, zero raw SQL; bounded depth (<=5) and node count (<=20).
4. **Saved Views System**: Personal, Shared, and Tenant-level view configurations with safe column and filter specifications.
5. **Scheduled Search Alerts**: Background job evaluation (M36) with automated omnichannel dispatches (M43) respecting user quiet hours.
6. **User Context & Preferences**: Automatic search history tracking, recent items drawer, and starred cross-domain favorites.
7. **Developer Platform & Workflow Actions**: 5 public API contracts (M41) and 2 automated workflow actions (M40).

## Invariant Compliance Summary

- **INV-476 to INV-500**: 25/25 Verified & Enforced
- **Cumulative Invariants**: 500/500 Verified (M01–M44)

## Guide Index

- [01. Architecture Guide](./01-architecture-guide.md)
- [02. Search Engine Guide](./02-search-engine-guide.md)
- [03. Provider Architecture](./03-provider-architecture.md)
- [04. Query Language Specification](./04-query-language-specification.md)
- [05. Filter Validation](./05-filter-validation.md)
- [06. Ranking Engine](./06-ranking.md)
- [07. Saved Views](./07-saved-views.md)
- [08. View Sharing & Collaboration](./08-sharing.md)
- [09. Search History](./09-search-history.md)
- [10. Recent Items](./10-recent-items.md)
- [11. Favorites & Bookmarks](./11-favorites.md)
- [12. Search Alerts](./12-search-alerts.md)
- [13. Notification Integration (M43)](./13-notification-integration.md)
- [14. Workflow Integration (M40)](./14-workflow-integration.md)
- [15. Public API Guide (M41)](./15-api-guide.md)
- [16. Security Guide](./16-security-guide.md)
- [17. Performance & Concurrency Guide](./17-performance-guide.md)
- [18. Caching Strategy](./18-caching-guide.md)
- [19. Operational & Telemetry Guide](./19-operational-guide.md)
