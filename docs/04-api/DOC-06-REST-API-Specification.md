# DOC-06: REST API Specification

**Version:** 1.0 | **Status:** APPROVED | **Date:** 2026-08-27
**Purpose:** API conventions and endpoints.
**Owner:** Senior Software Architect

## API Conventions

- **Base Path:** `/api/v1`
- **Format:** JSON.
- **Authentication:** `Authorization: Bearer <access_token>`

## Response Format

**Success:**

```json
{
  "success": true,
  "data": {},
  "message": "Success message"
}
```

**Error:**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error details"
  }
}
```

## Pagination

Use query params `?page=1&limit=20`. Responses include a `meta` object with `page`, `limit`, `total`, `total_pages`.

## Endpoints

- **Auth:** `POST /api/v1/auth/login`, `POST /api/v1/auth/register`, `POST /api/v1/auth/refresh`
- **Organizations:** `GET /api/v1/organization`, `PATCH /api/v1/organization`
- **Users:** `GET /api/v1/users/me`, `PATCH /api/v1/users/me`
- **Roles:** `GET /api/v1/roles`, `POST /api/v1/roles`
