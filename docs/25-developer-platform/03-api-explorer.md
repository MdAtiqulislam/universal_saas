# 03 - API Explorer & SSRF Defense

## Overview

The API Explorer in the Developer Portal allows administrators and engineers to test live endpoints directly from the browser without needing cURL or external HTTP clients.

## Security Architecture & SSRF Prevention

Allowing arbitrary HTTP requests from a backend service creates critical Server-Side Request Forgery (SSRF) vulnerabilities. The Universal SaaS API Explorer adheres to a strict zero-SSRF architecture:

1. **Pre-Registered Endpoint Whitelist**:
   - The explorer does NOT accept arbitrary target URLs or hostnames.
   - The client passes an `endpointId` corresponding to a cataloged definition in `ApiContractService`.
   - If `endpointId` does not match an existing public contract, `ApiExplorerService` immediately aborts with HTTP 400 Bad Request.

2. **Tenant Boundary Enforcement**:
   - The caller's authenticated `organizationId` is enforced on every explorer execution.
   - Any path or query parameter representing tenant identity is bound or overridden by the session's organization.

3. **Input Parameter Validation**:
   - Query and path parameters are validated against defined parameter types (`string`, `number`, `boolean`, `uuid`).
   - Request bodies are checked against required fields before dispatch.

4. **Internal Dispatch**:
   - Executions are dispatched against the platform's internal HTTP loopback interface (`http://127.0.0.1:<PORT>`), avoiding external DNS resolution and external network routing.
   - Execution duration, response status code, headers, and payload are sanitized and returned in a standard execution result envelope.
