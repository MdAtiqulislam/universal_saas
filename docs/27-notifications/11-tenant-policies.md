# 11. Tenant Communication Policies

## Organization Guardrails (`INV-463`)

Tenant administrators establish global communication policies via `CommunicationPolicy` to protect reputation and adhere to regional compliance laws:

- **Rate Limiting**:
  - `maxPerUserPerHour`: Prevents runaway script executions or loops from spamming users.
- **Mandatory Compliance Elements**:
  - `requireOptOutLink`: Automatically injects RFC-8058 compliant one-click unsubscribe links in email bodies.
  - `disclaimerFooter`: Enforces standardized legal or regulatory disclaimers appended to all outgoing customer messages.
- **Auditing**:
  - Modifications to communication policies generate immutable audit log records via `M37 SecurityEventsService` and `AuditService`.
