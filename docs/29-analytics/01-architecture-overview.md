# Analytics Architecture Overview

## Executive Summary

Milestone M45 establishes the centralized **Analytics, Reporting & Business Intelligence Foundation** for the Universal Business Operations SaaS platform. Adhering to the core architectural tenet **"One Analytics Engine -> Many Domain Reports"**, M45 provides unified query capabilities across 12 business domains using a PostgreSQL-first architecture with zero external data warehouse dependencies.

## Key Architectural Tenets

1. **PostgreSQL-First Execution**: Queries run directly against multi-tenant PostgreSQL tables with parameterized queries, eliminating external cluster synchronization issues.
2. **Authoritative Dataset Catalog**: In-code registry (`AnalyticsDefinitionRegistry`) declares allowed dimensions, measures, supported aggregations, and filter fields.
3. **Declarative Filter AST**: Bounded AST engine (`validateFilterAst`) prevents arbitrary code execution and query denial-of-service.
4. **Minor-Unit Financial Arithmetic**: Financial measures sum integer cents (`BigInt`), preventing floating-point rounding errors.
5. **Multi-Tenant Isolation**: Every query and resource is strictly partitioned by `organizationId`.
