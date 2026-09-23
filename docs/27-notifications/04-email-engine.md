# 04. Email Delivery Engine

## Transactional Email Architecture

The email delivery subsystem routes transactional and notification emails through standard SMTP/API gateways:

- **Sandbox Adapter**: `SandboxEmailProviderAdapter` enables end-to-end integration testing with zero external SMTP credentials.
- **Validation**: Strict RFC-compliant regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) rejects invalid addresses before dispatch (`INV-454`).
- **Bounce & Error Handling**:
  - Addresses matching `*bounce@*` simulate hard bounces (classified as `PERMANENT`).
  - Addresses matching `*fail@*` simulate transient gateway timeouts (classified as `TRANSIENT`).
- **Headers & Compliance**: Automatic injection of `List-Unsubscribe` headers (RFC 8058) and tenant-level legal disclaimers.
