# ADR-032: Bank Statement Matching Strategy

## Status

Accepted

## Context

When importing bank statements, transactions must be correlated with internal payment transactions (M15) or existing General Ledger journal entries (M12). Fuzzy auto-matching risks reconciling mismatched transactions without operator confirmation.

## Decision

1. Implement deterministic suggestion scoring (`EXACT_MATCH` vs `POSSIBLE_MATCH`) based on:
   - Identical Payment Account and Currency
   - Exact Amount match
   - Reference and Payment Number containment
   - Same Transaction Date
2. System never silently auto-finalizes ambiguous matches.
3. Every match is persisted with `matchedPaymentId` or `matchedJournalEntryId`, `reconciledByUserId`, and `reconciliationDate`.
4. Enforce strict single-match constraints so that an internal payment cannot be matched against multiple bank statement lines.

## Consequences

- Protects against duplicate matches.
- Audits all reconciliation actions with user attribution.
