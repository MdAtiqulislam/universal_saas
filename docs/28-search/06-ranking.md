# 06 — Deterministic Ranking & Tie-Breaking Engine

## Relevance Scoring Formula

The `SearchRankingService` calculates a deterministic score for each candidate record:

```typescript
let score = 0;

// 1. Exact ID Match (Primary Key / Code)
if (cleanId === cleanQuery) score += 1000;

// 2. Exact Title Match
if (cleanTitle === cleanQuery) score += 800;
else if (cleanTitle.startsWith(cleanQuery)) score += 500;
else if (cleanTitle.includes(cleanQuery)) score += 300;

// 3. Token-Level Matches
const tokens = cleanQuery.split(/\s+/).filter(Boolean);
for (const t of tokens) {
  if (cleanTitle.includes(t) || cleanSubtitle.includes(t)) {
    tokenMatches++;
  }
}
score += Math.min(400, tokenMatches * 150);

// 4. Description / Context Match
if (cleanDesc.includes(cleanQuery) || cleanSubtitle.includes(cleanQuery)) {
  score += 100;
}

// 5. Recency Bonus (0 to 50 points based on linear 90-day degradation)
const ageDays = Math.max(
  0,
  (Date.now() - new Date(record.createdAt).getTime()) / (1000 * 60 * 60 * 24),
);
score += Math.max(0, Math.round(50 * (1 - ageDays / 90)));
```

## Deterministic Ordering (`INV-485`)

To prevent pagination jitter, all results are sorted strictly in three levels:

1. `score` DESC
2. `createdAt` DESC
3. `id` ASC (stable deterministic tie-breaker)
