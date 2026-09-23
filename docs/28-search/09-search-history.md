# 09 — Search History Architecture

## Isolated Personal Search History

The `SearchHistory` model tracks queries executed by users to provide quick re-discovery:

- `organizationId`: Tenant identity
- `userId`: Owner user identity
- `queryText`: Executed search term
- `scope`: Target scope
- `resultCount`: Number of matching results found
- `executedAt`: Timestamp of search

## Privacy Guarantees (`INV-486`, `INV-487`)

1. **User Scoping (`INV-486`)**: Search history belongs to exactly one user in one tenant.
2. **Access Isolation (`INV-487`)**: Queries to list search history strictly filter by `where: { organizationId, userId }`. Users cannot inspect or enumerate another user's private search history.
3. **Atomic Purge**: Users can clear their private search history at any time via `DELETE /api/v1/search/history`.
