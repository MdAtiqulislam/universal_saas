# Integration Connections

## Overview

Integration Connections link an organization to a specific third-party provider from the global provider catalog.

## Architecture

- **Global Catalog**: `IntegrationProvider` catalog contains supported providers (Stripe, Twilio, SendGrid, Shopify, etc.) shared platform-wide.
- **Tenant Connections**: `IntegrationConnection` records are isolated by `organizationId` with unique names per tenant.
- **Credential Protection**: Secrets associated with connections are stored in `IntegrationCredential` records encrypted with AES-256-GCM.

## Supported Credential Schemes

1. `API_KEY`: Static token or key.
2. `BEARER_TOKEN`: OAuth bearer token.
3. `BASIC_AUTH`: HTTP basic authentication credentials.
4. `OAUTH2`: Client credentials or refresh tokens.
5. `WEBHOOK_SECRET`: HMAC signing secret for inbound validation.

## API Endpoints

| Method   | Route                                  | Permission                        | Description                     |
| -------- | -------------------------------------- | --------------------------------- | ------------------------------- |
| `GET`    | `/api/v1/integrations/providers`       | `integrations.providers.view`     | List provider catalog           |
| `GET`    | `/api/v1/integrations/connections`     | `integrations.connections.view`   | List organization connections   |
| `POST`   | `/api/v1/integrations/connections`     | `integrations.connections.manage` | Create a new connection         |
| `PUT`    | `/api/v1/integrations/connections/:id` | `integrations.connections.manage` | Update connection configuration |
| `DELETE` | `/api/v1/integrations/connections/:id` | `integrations.connections.manage` | Soft-delete a connection        |
