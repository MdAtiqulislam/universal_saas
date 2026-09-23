# 11. Billing Security, Zero Secrets & PCI Compliance

## Security Architecture (INV-450)

- **Zero Raw Card Data**: The platform is engineered to strictly satisfy PCI-DSS SAQ-A. Credit card numbers, expiration dates, and CVVs are never handled, accepted, or persisted by backend services. All credit card inputs are captured via provider-hosted elements or tokens.
- **AES-256-GCM Encryption**: Any sensitive gateway keys, signing secrets, or connection configurations are encrypted at rest using AES-256-GCM.
- **PII & Secret Redaction**: The `StructuredLoggingService` automatically intercepts and redacts restricted keys (`password`, `secret`, `apiKey`, `token`, `cookie`) before logs are emitted or persisted.
- **RBAC Governance**: All administrative billing routes are guarded by `JwtAuthGuard`, `PermissionGuard`, and explicit permissions (`billing.plans.manage`, `billing.invoices.manage`, `billing.admin`).
