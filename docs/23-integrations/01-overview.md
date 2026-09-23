# M39: Integration Platform Overview

M39 introduces a unified integration foundation to the Universal Business Operations SaaS, providing:

- **Outbound Webhooks**: Deliver real-time platform domain events to external subscriber endpoints with retry and signature verification.
- **Inbound Webhooks**: Receive and process external events (payment confirmations, carrier tracking, supplier updates) with signature checks and idempotent ingestion.
- **API Keys**: Provide secure programmatic authentication with fine-grained permission scopes for automated pipelines.
- **Integration Connections**: Manage tenant-isolated connections to external providers with AES-256-GCM encrypted credentials.
- **Integration Event Log**: Immutable audit trail of all dispatched domain events.

## Architecture

M39 serves strictly as an orchestration and transport boundary:

- Does NOT duplicate business logic, domain state machines, or ledgers from M01–M38.
- Integrates with the in-process `EventBusService` to listen for domain events.
- Leverages the M36 `JobService` for asynchronous, resilient background delivery.
- Uses the M36 `IdempotencyService` to prevent duplicate processing of inbound events.
- Uses M38 `StructuredLoggingService` for full traceability.

## Key Invariants (INV-351–375)

| Invariant | Description                                                           |
| --------- | --------------------------------------------------------------------- |
| INV-351   | Integration provider status uses valid enum values                    |
| INV-352   | Connection name is unique per organization                            |
| INV-353   | Credentials are encrypted with AES-256-GCM; plaintext is never stored |
| INV-354   | API keys store SHA-256 hash only; raw key shown once                  |
| INV-355   | Webhook endpoint must be HTTPS and pass SSRF validation               |
| INV-356   | Integration events are immutable once created                         |
| INV-357   | (subscriptionId, integrationEventId) is unique in webhook_deliveries  |
| INV-358   | (connectionId, providerEventId) is unique in inbound_webhook_events   |
| INV-359   | Connection status transitions follow valid states                     |
| INV-360   | Webhook delivery status follows valid lifecycle                       |
| INV-361   | Inbound webhook status follows valid lifecycle                        |
| INV-362   | Credential type must be one of supported schemes                      |
| INV-363   | Webhook subscription status uses valid enum values                    |
| INV-364   | API key prefix is exactly 8 characters                                |
| INV-365   | API key hash is 64 hex characters                                     |
| INV-366   | Provider providerKey is globally unique                               |
| INV-367   | IntegrationEvent eventId is unique per organization                   |
| INV-368   | Webhook delivery moves to DEAD_LETTER when attempts exhausted         |
| INV-369   | Webhook signing secret never exposed in list responses                |
| INV-370   | Credential ciphertext/IV never exposed in list responses              |
| INV-371   | Inbound webhook deduplication uses connectionId + providerEventId     |
| INV-372   | Outbound delivery uses exponential backoff retry                      |
| INV-373   | All tenant models enforce organizationId scoping                      |
| INV-374   | Provider catalog is globally shared across tenants                    |
| INV-375   | API key revokedAt permanently invalidates the key                     |
