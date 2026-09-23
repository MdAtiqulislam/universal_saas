# ADR-121: Webhook SSRF Protection

**Status:** Accepted  
**Date:** 2026-09-02  
**Milestone:** M39

## Context

Outbound webhook endpoints are user-supplied URLs. Without robust protection, malicious actors could configure webhooks pointing to internal network resources (cloud metadata services, internal databases, loopback addresses), leading to Server-Side Request Forgery (SSRF) vulnerabilities.

## Decision

The `SsrfGuardService` validates all webhook endpoints at subscription creation and update time:

1. **HTTPS only**: Endpoints must use the `https://` protocol. Unencrypted `http://` is strictly rejected.
2. **Hostname resolution**: Hostnames are resolved via DNS (`dns/promises.lookup`), and all resolved IPv4 and IPv6 addresses are inspected.
3. **Private IP range blocking**: All RFC-1918 private ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), loopback (`127.0.0.0/8`), link-local (`169.254.0.0/16`), and IPv6 ULA (`fc00::/7`) / loopback (`::1`) are blocked.
4. **Loopback hostname blocking**: `localhost`, `0.0.0.0`, and similar local references are rejected by name.
5. **Pre-flight write-time enforcement**: Endpoints failing validation are rejected with a `BadRequestException` and never persisted.

## Consequences

- Outbound webhooks cannot target private corporate subnets or cloud provider internal APIs.
- Eliminates SSRF vectors targeting internal infrastructure.
- Safe external destinations with public DNS records are supported seamlessly.
