# ADR-074: Shipment and Logistics Management Architecture

## Status

Accepted

## Context

Following the completion of Milestone M28 (Customer Fulfillment & Delivery Orders), the platform requires an external transport and logistics tracking layer. The system must manage carrier profiles, tracking numbers, vehicle assignments, freight and insurance costs, and transport events without duplicating physical warehouse inventory balances or accounting journals.

## Decision

1. Introduce a dedicated `shipping` domain module orchestrating shipment headers, carrier masters, transport vehicles, package metadata, and tracking events.
2. Establish clean foreign key relationships to M28 `DeliveryOrder`, M28 `SalesOrder`, and M11 `Customer`.
3. Require exact `Prisma.Decimal` arithmetic for `shippingCost`, `insuranceCost`, `otherCost`, and `totalLogisticsCost`.
4. Isolate all carrier and shipment records per tenant (`organizationId`).

## Consequences

- Clean separation between internal warehouse execution (`DeliveryOrder`) and external carrier logistics (`Shipment`).
- Zero duplicate data or secondary domain engines.
- Strict tenant boundary enforcement across all logistics queries and mutations.
