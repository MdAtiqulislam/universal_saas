# DOC-23: Risk Register

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** Identify and mitigate project risks.
**Owner:** Product Manager

| Risk ID | Risk                                | Probability | Impact | Severity | Mitigation                                                                       | Owner              | Status |
| ------- | ----------------------------------- | ----------- | ------ | -------- | -------------------------------------------------------------------------------- | ------------------ | ------ |
| R-01    | Legacy VFP Migration data anomalies | High        | High   | Critical | Execute extensive data discovery and dry-run migrations.                         | DB Architect       | Open   |
| R-02    | Cross-tenant data leakage           | Low         | High   | Critical | Enforce strict application-level tenant isolation; future use of PostgreSQL RLS. | Security Architect | Open   |
| R-03    | Industry configuration complexity   | Medium      | Medium | Major    | Use custom fields and metadata instead of hardcoding `if (industry)`.            | Sr Architect       | Open   |
