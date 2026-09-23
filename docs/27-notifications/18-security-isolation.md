# 18. Security, Tenant Isolation & Audit Trail

## Security Architecture (`INV-451`, `INV-452`, `INV-453`)

The notification subsystem enforces rigorous enterprise security controls:

- **Tenant Scoping (`INV-451`)**:
  - Every query and mutation filters strictly by `organizationId`. Attempting to access cross-tenant notifications or templates triggers HTTP 403 Forbidden.
- **Provider Credential Encryption (`INV-452`)**:
  - API keys, webhook signing secrets, and SMTP passwords stored in `CommunicationProviderConfig` are encrypted at rest using AES-256-GCM via `CredentialEncryptionService`.
- **Sensitive Payload Redaction (`INV-453`)**:
  - Passwords, access tokens, credit cards, and social security numbers are stripped from delivery logs and audit payloads via `AuditSanitizerService`.
- **Audit Trails**:
  - All administrative actions (template publishing, provider rotation, policy adjustments) generate structured events in `AuditService`.
