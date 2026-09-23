# 15 — Public API & Contract Guide (M41)

## Public Developer Endpoints

Search functionality is exposed on the platform's public API gateway under version `v1`:

### 1. Global Search

- **Endpoint**: `GET /api/v1/search`
- **Contract ID**: `search-global`
- **Required Scopes**: `search.read`, `api.read`
- **Parameters**: `q`, `scope`, `page`, `limit`, `sortBy`, `sortOrder`

### 2. Autocomplete Suggestions

- **Endpoint**: `GET /api/v1/search/suggestions`
- **Contract ID**: `search-suggestions`
- **Required Scopes**: `search.read`, `api.read`
- **Parameters**: `prefix` (required), `scope`

### 3. List Saved Views

- **Endpoint**: `GET /api/v1/saved-views`
- **Contract ID**: `saved-views-list`
- **Required Scopes**: `search.views.read`, `api.read`

### 4. Create Saved View

- **Endpoint**: `POST /api/v1/saved-views`
- **Contract ID**: `saved-views-create`
- **Required Scopes**: `search.views.manage`, `api.write`

### 5. Get Saved View

- **Endpoint**: `GET /api/v1/saved-views/:id`
- **Contract ID**: `saved-views-get`
- **Required Scopes**: `search.views.read`, `api.read`
