# ADR 078: Warehouse Topology and Storage Taxonomy

## Status

Accepted

## Context

As part of Milestone M30, the platform requires multi-level warehouse spatial modeling beyond simple single-level inventory locations. Facilities comprise receiving docks, bulk storage pallet racking, forward picking faces, cold storage, hazardous material zones, and shipping staging areas. A formal topology was necessary to enable automated pathing, storage rules, and capacity allocation without duplicating M09 core balance ledger tables.

## Decision

1. Introduce `WarehouseZone` representing functional divisions (`STORAGE`, `PICKING`, `BULK`, `COLD_STORAGE`, `HAZMAT`) tied to root `Location` entities.
2. Extend `Location` with `locationType` (`RECEIVING`, `STORAGE`, `PICK_FACE`, `STAGING`, `QUARANTINE`, `SCRAP`, `RETURN`, `DAMAGED`).
3. Store warehouse-wide default locations per tenant organization in `WarehouseConfiguration`.
4. Derive stock positions across zones and location types without creating redundant balance tables, calculating available stock as $\text{OnHand} - \text{Reserved} - \text{Quarantined}$ for active storage bins and 0 available for quarantine/damaged/scrap locations.

## Consequences

- Clean separation between spatial topology/execution logic and authoritative financial/cost inventory ledgers.
- High performance, multi-tenant scoped lookups and validation.
- Enables granular bin replenishment, cycle count scheduling by zone, and dedicated quarantine isolation.
