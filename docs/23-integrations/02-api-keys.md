# API Keys

## Overview

API keys provide programmatic access to the Universal Business Operations API without requiring interactive session tokens.

## Security Controls

- **Cryptographic Generation**: 256 bits of cryptographically secure entropy (`crypto.randomBytes(32)`).
- **One-Way Storage**: Only the SHA-256 hash is persisted. Raw keys cannot be retrieved by anyone after creation.
- **Prefix Identification**: An 8-character prefix allows identification without disclosing the secret key.
- **Scope Enforcement**: Keys may be restricted to a subset of system permissions.
- **Expiry & Revocation**: Keys support optional expiry timestamps and immediate soft revocation.

## API Endpoints

| Method   | Route                               | Permission                    | Description                |
| -------- | ----------------------------------- | ----------------------------- | -------------------------- |
| `GET`    | `/api/v1/integrations/api-keys`     | `integrations.apikeys.view`   | List organization API keys |
| `POST`   | `/api/v1/integrations/api-keys`     | `integrations.apikeys.manage` | Generate a new API key     |
| `DELETE` | `/api/v1/integrations/api-keys/:id` | `integrations.apikeys.manage` | Revoke an API key          |
