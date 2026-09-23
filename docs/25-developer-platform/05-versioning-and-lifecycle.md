# 05 - API Versioning & Deprecation Lifecycle

## Versioning Model

Universal SaaS employs explicit path-based major versioning:

- Current Production: `/api/v1`
- Next Major (Planning): `/api/v2`

### Backward-Compatibility Rules

- **Non-Breaking (Permitted in `/api/v1`)**:
  - Adding new optional request query parameters or request body properties.
  - Adding new fields to response JSON objects.
  - Adding new endpoints.
- **Breaking (Requires New Major Version `/api/v2`)**:
  - Renaming or removing existing endpoints.
  - Renaming or removing existing request/response fields.
  - Modifying the type or meaning of existing fields.
  - Adding mandatory required request parameters without defaults.

## Lifecycle States

Each API version follows a strict state transition model:

```
[ EXPERIMENTAL ]  -->  [ ACTIVE ]  -->  [ DEPRECATED ]  -->  [ SUNSET ]
```

1. **ACTIVE**:
   - Fully supported production standard.
   - Guaranteed SLA and security updates.
2. **DEPRECATED**:
   - Maintained in maintenance mode for a minimum 180-day grace period.
   - Responses include warning headers:
     - `Deprecation: true`
     - `Sunset: Wed, 01 Mar 2028 00:00:00 GMT`
     - `Link: </docs/migration/v1-to-v2>; rel="deprecation"`
3. **SUNSET**:
   - Retired. Endpoint returns HTTP 410 Gone with a message directing users to migration documentation.
