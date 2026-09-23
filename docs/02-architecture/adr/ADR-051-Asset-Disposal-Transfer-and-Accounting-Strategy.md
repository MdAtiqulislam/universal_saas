# ADR-051: Asset Disposal, Transfer and Accounting Strategy

## Status

Accepted

## Context

When fixed assets are retired, scrapped, sold, or moved between company facilities, the platform must adjust General Ledger accounts, write off accumulated depreciation, recognize gains or losses, and record location movements without altering historical acquisition data.

## Decision

1. **Asset Disposal Accounting**:
   - $\text{Net Book Value} = \text{Acquisition Cost} - \text{Accumulated Depreciation}$.
   - $\text{Gain/Loss} = \text{Disposal Proceeds} - \text{Net Book Value}$.
   - **Double-Entry Posting**:
     - **Debit**: Accumulated Depreciation (`ACCUMULATED_DEPRECIATION`) for full accumulated balance.
     - **Debit**: Cash / Bank / Receivable (`disposalProceeds`, if $> 0$).
     - **Debit**: Loss on Disposal (`ASSET_DISPOSAL_LOSS`, if $\text{Gain/Loss} < 0$).
     - **Credit**: Gain on Disposal (`ASSET_DISPOSAL_GAIN`, if $\text{Gain/Loss} > 0$).
     - **Credit**: Fixed Asset Account (`FIXED_ASSET`) for full acquisition cost.
   - Any future scheduled depreciation entries are marked `VOIDED`.
   - Asset status transitions to `DISPOSED`.
2. **Location Transfers**:
   - Update current `locationId` on `FixedAsset`.
   - Record immutable record in `AssetTransferHistory` with `fromLocationId`, `toLocationId`, `transferDate`, and `reason`.
   - Historical acquisition costs and accumulated depreciation are preserved without GL modification.

## Consequences

- Clean accounting removal of fixed assets with full gain/loss recognition.
- Complete operational traceability of asset movements across company sites.
