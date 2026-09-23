# ADR-076: Shipment Delivery and Return Integration

## Status

Accepted

## Context

When customer deliveries fail or goods are refused, the ERP must decide whether to automatically reverse stock balances or maintain logistics tracking decoupled from physical warehouse restock.

## Decision

1. Delivery confirmation (`DELIVERED`) marks external transport completion and records `actualDeliveryDate` and `deliveredByUserId`.
2. Failed delivery (`FAILED`) captures mandatory `failureReason` and logs an attempt tracking event without mutating inventory.
3. Returned shipments (`RETURNED`) record logistics custody return. Physical restocking is decoupled and requires explicit invocation of warehouse returns (M09/M28) after receiving inspection.

## Consequences

- Prevents "phantom stock" in warehouses where damaged or returned goods were not yet inspected.
- Preserves absolute accuracy of real-time inventory balances.
