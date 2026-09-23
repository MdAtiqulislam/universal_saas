# 02 - Authentication & Granular API Scopes

## API Key Authentication Model

Public API endpoints support authentication via header tokens using either:

- `X-API-Key: <raw_key>`
- `Authorization: Bearer <raw_key>`

### Key Storage & Validation

- Raw keys are generated once during key creation (`sk_live_...` or `pk_live_...`) and presented to the user only once.
- The database stores only the 64-character SHA-256 hash in `ApiKey.sha256Hash` along with an 8-character identifying prefix (`ApiKey.keyPrefix`).
- `ApiKeyAuthGuard` hashes the supplied token using SHA-256 and retrieves the key record.
- If the key is expired (`expiresAt <= now()`) or revoked (`revokedAt !== null`), authentication fails with HTTP 401 Unauthorized.
- Successful verification binds `request.apiKey` and establishes the tenant boundary `request.tenantContext = { organizationId: apiKey.organizationId }`.

## Scope Evaluation (`@RequireApiScopes`)

Endpoints declare required scopes via the `@RequireApiScopes(...)` decorator and are enforced by `ApiScopeGuard`.

### Standard Scopes

- `accounting.read` / `accounting.write`: Financial subledgers, invoices, payments, charts of accounts.
- `crm.read` / `crm.write`: Leads, opportunities, customers, quotations.
- `inventory.read` / `inventory.write`: Stock levels, warehouses, transfers, valuations.
- `webhooks.read` / `webhooks.write`: Webhook subscriptions and delivery histories.
- `workflows.read` / `workflows.write`: Workflow definitions, versions, and execution logs.
- `developer.read` / `developer.write`: Developer portal telemetry and API contract queries.
- `api.admin`: Universal administrative scope granting access to all public endpoints for the authenticated organization.

### Scope Evaluation Rules

1. If an endpoint requires no scopes, any valid active API key for the organization is permitted.
2. If an API key possesses `api.admin`, all scope checks pass automatically.
3. Otherwise, the key must contain every scope specified in `@RequireApiScopes(...)` (AND condition). If any required scope is missing, HTTP 403 Forbidden is returned.
