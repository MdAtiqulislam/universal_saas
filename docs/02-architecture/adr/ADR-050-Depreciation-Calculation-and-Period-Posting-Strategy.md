# ADR-050: Depreciation Calculation and Period Posting Strategy

## Status

Accepted

## Context

Fixed assets lose carrying value over their useful life and must be depreciated periodically. The calculation must be mathematically deterministic, respect residual value floors, absorb rounding differences gracefully, and post double-entry journals idempotently into open accounting fiscal periods.

## Decision

1. **Straight-Line Depreciation Engine**:
   - $\text{Depreciable Base} = \text{Acquisition Cost} - \text{Residual Value}$
   - $\text{Monthly Depreciation} = \frac{\text{Depreciable Base}}{\text{Useful Life in Months}}$
   - Final period absorbs any cumulative fractional rounding discrepancies: $\text{Depreciation}_{\text{final}} = \text{Depreciable Base} - \text{Accumulated Depreciation}$.
2. **Pre-Generated Persisted Schedule**:
   - Capitalization generates rows in `AssetDepreciationEntry` with initial status `SCHEDULED`.
3. **Transactional Period Runs**:
   - `POST /api/v1/assets/depreciation-runs` queries scheduled entries for an open `FiscalPeriod` and posts double-entry journal entries:
     - **Debit**: Depreciation Expense Account (`DEPRECIATION_EXPENSE`).
     - **Credit**: Accumulated Depreciation Account (`ACCUMULATED_DEPRECIATION`).
   - Idempotent: Subsequent execution on the same fiscal period ignores already `POSTED` entries.
4. **Residual Value Invariant**:
   - Carrying net book value ($\text{NBV} = \text{Acquisition Cost} - \text{Accumulated Depreciation}$) is strictly bounded below by `residualValue`.

## Consequences

- Deterministic, repeatable depreciation schedules.
- Robust protection against over-depreciation and duplicate General Ledger postings.
