# 07 - Error Handling & Problem Details (RFC 7807)

## Uniform Error Response Format

All public API errors follow RFC 7807 Problem Details for HTTP APIs:

```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "API key lacks required scope: crm.write",
  "errorCode": "FORBIDDEN_SCOPE",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-09-04T12:00:00.000Z"
}
```

## Standard Error Code Taxonomy

| HTTP Status | Error Code                  | Description                                | Resolution                                                    |
| ----------- | --------------------------- | ------------------------------------------ | ------------------------------------------------------------- |
| 400         | `BAD_REQUEST`               | Malformed JSON or invalid parameter syntax | Check parameter types and JSON schema                         |
| 400         | `UNREGISTERED_ENDPOINT`     | API Explorer target route not recognized   | Select a valid endpoint from contract registry                |
| 401         | `UNAUTHORIZED`              | Missing or invalid API key                 | Provide a valid `X-API-Key` or `Authorization: Bearer` header |
| 401         | `API_KEY_EXPIRED`           | API key has exceeded its expiration date   | Rotate or regenerate the API key in the Developer Portal      |
| 401         | `API_KEY_REVOKED`           | API key has been revoked                   | Issue a new API key                                           |
| 403         | `FORBIDDEN_TENANT_MISMATCH` | Key does not belong to the target tenant   | Ensure API key matches the target organization                |
| 403         | `FORBIDDEN_SCOPE`           | Key lacks one or more required scopes      | Grant missing scopes to the API key                           |
| 404         | `NOT_FOUND`                 | Requested entity does not exist            | Verify resource ID and tenant boundary                        |
| 429         | `RATE_LIMIT_EXCEEDED`       | Request rate exceeded tier quota           | Implement exponential backoff or request quota increase       |
| 500         | `INTERNAL_SERVER_ERROR`     | Unexpected platform error                  | Quote `requestId` to platform support team                    |
