# ADR-152: Composable Multi-Tenant Dashboard Layouts and Widget Typing

## Status

Accepted

## Context

Enterprise users need configurable visual dashboards containing multiple charts, KPI summaries, and data tables. Dashboards must support multi-tenant isolation, fine-grained access sharing (user/role/team), and graceful degradation if an individual widget's underlying dataset fails.

## Decision

We implement a **Composable Multi-Tenant Dashboard Model**:

1. **First-Class Entities**: `Dashboard`, `DashboardWidget`, and `DashboardShare` models in PostgreSQL.
2. **Widget Types**: Constrained to 6 visual representations: `METRIC_CARD`, `CHART_LINE`, `CHART_BAR`, `CHART_PIE`, `TABLE`, `KPI_SUMMARY`.
3. **Widget Isolation**: Each widget operates as an independent execution unit. If a widget query encounters an error, only that widget displays an error boundary; the rest of the dashboard renders seamlessly.
4. **Access Boundaries**: Dashboards support `PRIVATE`, `ORGANIZATION`, and `PUBLIC` visibilities, with explicit sharing grants to users, roles, and teams.

## Consequences

### Positive

- High resilience and decoupled widget execution.
- Consistent styling and responsiveness across grid layouts.
- Tenant isolation enforced at database and API layers.

## Related Invariants

- `INV-512`: Composable Multi-Tenant Dashboards
- `INV-513`: Dashboard Widget Typing & Layout Bounds
- `INV-521`: Widget Query Isolation & Safe Failure Handling
