# 06 - SDK & OpenAPI Contract Strategy

## Dynamic OpenAPI Specification Generation

The backend exposes an auto-generated, production-ready OpenAPI 3.0.3 specification at:
`GET /developer/docs/openapi.json`

### Spec Features

- **Security Schemes**: Defines both `ApiKeyAuth` (header `X-API-Key`) and `BearerAuth` (header `Authorization: Bearer <token>`).
- **Domain Tagging**: Endpoints are categorized under clean domain tags: `Accounting`, `CRM`, `Inventory`, `Webhooks`, `Workflows`, `Developer`.
- **Parameter Schemas**: Fully describes query parameters, path variables, request bodies, and JSON schemas.
- **RFC 7807 Standardized Errors**: Documents 400, 401, 403, 404, 429, and 500 error responses with standardized schema objects.

## Client SDK Generation

Third-party client SDKs can be compiled directly from `/developer/docs/openapi.json` using open-source tools:

### TypeScript SDK

```bash
npx openapi-generator-cli generate \
  -i https://api.universal-saas.com/developer/docs/openapi.json \
  -g typescript-axios \
  -o ./sdks/typescript \
  --additional-properties=npmName=@universal-saas/sdk,supportsES6=true
```

### Python SDK

```bash
npx openapi-generator-cli generate \
  -i https://api.universal-saas.com/developer/docs/openapi.json \
  -g python \
  -o ./sdks/python \
  --additional-properties=packageName=universal_saas_sdk
```
