# ADR-022: Journal Posting Engine, Immutability, and Compensating Reversals

## Status

Accepted

## Context

General ledger transactions must be tamper-evident and audit-compliant (GAAP / IFRS). Once a journal entry is posted, it must never be updated or deleted directly in the database. When an error occurs in a posted transaction, the correction must be accomplished via a compensating reversal entry.

## Decision

### 1. Posting Lifecycle

- `DRAFT`: Can be updated, deleted, and lines modified.
- `POSTED`: Immutable. Neither header nor lines can be updated or deleted.
- `VOIDED`: Marked when a compensating reversal has been generated.

### 2. Transactional Posting Engine

The posting operation runs within a database transaction:

1. Validates journal status is `DRAFT`.
2. Validates fiscal period is `OPEN`.
3. Validates all accounts are active, non-deleted, and belong to the organization.
4. Validates line counts $\ge 2$ and $\sum \text{Debit} == \sum \text{Credit}$.
5. Updates status to `POSTED`, stamps `postedAt` and `postedByUserId`.
6. Publishes `JOURNAL_POSTED` domain event to internal event bus.

### 3. Compensating Reversals

Reversal creates a new `JournalEntry` referencing `sourceType = 'REVERSAL'` and `sourceId = originalJournal.id`, copying all lines with debits and credits inverted. The original entry is marked `VOIDED`.

## Consequences

- **Positive**: Complete compliance with accounting immutability standards; non-destructive audit trail.
- **Negative**: Reversing large journal entries creates additional ledger rows.
