# ADR-133: SDK and OpenAPI Contract Strategy

**Status:** Accepted  
**Date:** 2026-09-04  
**Milestone:** M41

## Context

To accelerate integration development, developers require standardized API contracts and language-specific SDKs. Maintaining manual documentation and hand-crafted SDKs leads to drift between code and documentation.

## Decision

1. **Single Source of Truth**: The `ApiContractService` acts as the definitive source of truth for public API contracts, parameters, authentication scopes, request bodies, response models, and error codes.
2. **Dynamic OpenAPI 3.0.3 Generation**: The platform generates a compliant OpenAPI 3.0.3 specification on demand at `GET /developer/docs/openapi.json`. This spec incorporates security schemes (`BearerAuth`, `ApiKeyAuth`), tagged domain groupings, and standardized JSON schema definitions.
3. **Automated SDK Generation Foundation**: SDK generation pipelines (e.g. OpenAPI Generator, Fern, or Kiota) ingest the live OpenAPI spec to produce TypeScript and Python client SDKs.
4. **Uniform Error Envelope**: All API error responses conform to the standard RFC 7807 problem details structure (`statusCode`, `error`, `message`, `errorCode`, `timestamp`, `requestId`).
5. **Interactive Contract Discovery**: The Developer Portal renders interactive documentation directly from the live contract service, ensuring documentation is never out of sync with backend routing.

## Consequences

- Third-party developers can download the OpenAPI specification or generate client stubs in any major programming language.
- Client SDKs automatically inherit type definitions, parameter validations, and authentication helpers.
