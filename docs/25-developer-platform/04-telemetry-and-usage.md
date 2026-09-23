# 04 - API Telemetry & Usage Analytics

## Telemetry Collection

Every invocation of a public API route (`/api/v1/*`) passes through `ApiUsageInterceptor`.

### Telemetry Pipeline

1. **Clock Initiation**: High-resolution performance timer begins at request arrival.
2. **Execution Monitoring**: The request proceeds through route handlers and filters.
3. **Response Interception**: On completion or error:
   - Duration is calculated in milliseconds (`durationMs = now - start`).
   - HTTP status code is recorded (`statusCode`).
   - Response class is derived (`2xx`, `3xx`, `4xx`, `5xx`).
4. **Data Masking & Normalization**:
   - `ipHash`: Raw client IP is salted and converted to a SHA-256 hash. Plaintext IPs are never stored.
   - `route`: Query strings (`?foo=bar`) are stripped, keeping only the canonical route path.
   - `userAgent`: Client identifier truncated to 255 characters.
5. **Asynchronous Ingestion**: Ingested via `ApiUsageService.recordUsage()` into the `ApiUsageRecord` table. Errors during telemetry insertion are caught and logged without affecting the HTTP response.
6. **Platform Counter Aggregation**: M38 `MetricsService` counters are incremented (`platform.api.requests.total`, `platform.api.requests.2xx`, etc.).

## Usage Reporting & CSV Export

- `GET /developer/usage`: Returns paginated usage records filtered by date range, route, status code, and API key.
- `GET /developer/usage/summary`: Aggregates total requests, success rate, average duration, p95 latency, and top routes.
- `POST /developer/usage/export`: Exports up to 10,000 usage records as standard CSV, logging an audit trail event (`api_usage.exported`).
