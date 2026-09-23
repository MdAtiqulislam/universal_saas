# 12. Provider Abstraction & Failover

## Resilient Delivery Architecture (`INV-464`, `INV-465`)

The platform abstracts communication vendors behind the `ChannelProviderAdapter` interface:

- **Adapter Contract**:
  - `send(params: ProviderSendParams): Promise<ProviderSendResult>`
  - `validateDestination(destination: string): boolean`
  - `healthCheck(): Promise<ProviderHealthResult>`
- **Ordered Priority Failover**:
  - Providers configured in `CommunicationProviderConfig` are sorted by `priority ASC`.
  - When the primary provider encounters a transient failure (HTTP 429, 503, timeout), the delivery engine immediately attempts the next healthy fallback adapter.
- **Error Classification**:
  - `TRANSIENT`: Network timeouts, rate limiting, temporary upstream gateway downtime -> triggers failover and exponential backoff retry.
  - `PERMANENT`: Malformed address/phone number, unregistered device token, hard bounce -> halts retry loop immediately to avoid billing leaks.
