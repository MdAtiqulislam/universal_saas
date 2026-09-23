# 01 — Unified Search Architecture Guide

## High-Level Architecture

The Unified Search Platform coordinates cross-domain record discovery through a layered, decoupled service architecture:

```
+-------------------------------------------------------------------------+
|                  Client Layer (Web UI / API Consumers)                  |
|          GlobalSearchModal, SearchDashboard, REST API Endpoints         |
+-------------------------------------------------------------------------+
                                    |
                                    v
+-------------------------------------------------------------------------+
|                Search Controller & Orchestrator Layer                   |
|                        UnifiedSearchService                             |
|    - Permission-aware provider resolution (INV-479)                     |
|    - Tenant isolation boundary (INV-478)                                |
|    - Bounded concurrency fan-out (concurrency = 5)                      |
|    - Tenant-isolated Cache Key hashing (INV-498)                        |
+-------------------------------------------------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                                               |
            v                                               v
+-----------------------+                       +-----------------------+
|  Ranking & Filtering  |                       | 11 Domain Providers   |
|  - SearchRanking      |                       | - CustomerProvider    |
|  - FilterAstEngine    |                       | - SalesProvider       |
|    (Zero-eval AST)    |                       | - InventoryProvider   |
+-----------------------+                       | - WarehouseProvider   |
                                                | - QualityProvider     |
                                                | - ReturnsProvider     |
                                                | - ServiceProvider     |
                                                | - FinanceProvider     |
                                                | - WorkflowProvider    |
                                                | - NotifProvider       |
                                                | - UserProvider        |
                                                +-----------------------+
                                                            |
                                                            v
                                                +-----------------------+
                                                | PostgreSQL / Prisma   |
                                                +-----------------------+
```

## Multi-Tenant Security Boundaries

1. **Query-Level Scoping (`INV-478`)**: Every database query executed by an underlying provider binds `organizationId = caller.organizationId`. Records from other tenants can never be returned.
2. **Permission Gating (`INV-479`)**: Prior to dispatching a search query, `UnifiedSearchService` checks whether the caller's JWT tokens or API key contains the required domain permission (e.g., `finance.invoices.read`, `crm.customers.read`). Unentitled domain providers are completely excluded from query execution.
3. **Deterministic Cache Keys (`INV-498`)**: Search responses are cached with keys formed as:
   `tenant:{organizationId}:search:{permissionsHash}:{queryHash}`
   This guarantees that cache hits can never leak data across organizations or to users with differing authorization levels.
