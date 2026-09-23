# Milestone M29 — Shipment & Logistics Management Foundation

## 1. Executive Summary

Milestone M29 establishes a multi-tenant logistics orchestration layer on top of Milestone M28 (Sales Order Management & Customer Fulfillment). It links physical warehouse fulfillment to carrier assignment, vehicle tracking, dispatch, real-time in-transit tracking, proof of delivery, delivery failure exception management, and returned shipments without duplicating inventory, invoicing, payment, or general ledger engines.

---

## 2. Order-to-Shipment Flow

```text
M28 Sales Order
      ↓
M28 Delivery Order
      ↓
Warehouse Picked / Ready
      ↓
M29 Shipment Creation
      ↓
Carrier & Vehicle Assignment
      ↓
Shipment Dispatch (actualShipDate recorded)
      ↓
In-Transit Tracking Timeline
      ↓
Delivered / Failed / Returned
      ↓
Shipment Closed
```

---

## 3. Authoritative Architectural Boundaries

| Domain                             | Authoritative Milestone | Interaction Mode                                                                                             |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| **Inventory Balances & Movements** | M09 Inventory           | M28 Delivery Order triggers `StockMovement(ISSUE)`. M29 tracks logistics transit without mutating inventory. |
| **Inventory Costing & COGS**       | M19 Costing             | Triggered at delivery execution. M29 records logistics costs (`shippingCost`, `insuranceCost`) separately.   |
| **Customer Master Data**           | M11 Customers           | Read-only foreign reference `customerId`.                                                                    |
| **Customer Invoicing & AR**        | M14 Invoicing           | Associated via `salesOrderId` / `deliveryOrderId`. M29 does not create duplicate invoices.                   |
| **Payment Settlement**             | M15 Payments            | Unchanged.                                                                                                   |
| **Sales Order & Fulfillment**      | M28 Sales Orders        | Source of demand and fulfillment line quantities.                                                            |

---

## 4. Lifecycle State Machine

### Normal Path:

$$\text{DRAFT} \to \text{READY} \to \text{ASSIGNED} \to \text{DISPATCHED} \to \text{IN\_TRANSIT} \to \text{DELIVERED} \to \text{CLOSED}$$

### Exception Paths:

- $\text{DRAFT / READY / ASSIGNED} \to \text{CANCELLED}$
- $\text{DISPATCHED / IN\_TRANSIT} \to \text{FAILED}$
- $\text{FAILED / IN\_TRANSIT} \to \text{RETURNED} \to \text{CLOSED}$
- $\text{DELIVERED / RETURNED} \to \text{CLOSED}$

---

## 5. Non-Automatic Inventory Restocking on Failed Delivery

> **Core ERP Principle**: A logistics return is not automatically an inventory restock. Physical receiving inspection must occur in the warehouse before goods are re-stocked into available balance via M09/M28 returns.

---

## 6. Database Models & Schema

1. **`ShipmentCarrier`**: Tenant-scoped carrier master (`code`, `name`, `carrierType`, `contactName`, `phone`, `email`, `trackingUrlTemplate`, `isActive`).
2. **`ShipmentVehicle`**: Vehicle registration (`registrationNumber`, `vehicleType`, `driverName`, `driverPhone`, `isActive`).
3. **`Shipment`**: Shipment header (`shipmentNumber`, `deliveryOrderId`, `salesOrderId`, `customerId`, `carrierId`, `vehicleId`, `status`, `shippingCost`, `insuranceCost`, `otherCost`, `totalLogisticsCost`, `trackingNumber`, timestamps).
4. **`ShipmentLine`**: Logistics line items referencing `deliveryOrderLineId` and `salesOrderLineId`.
5. **`ShipmentPackage`**: Packaging dimensions and weights (`packageNumber`, `weight`, `dimensions`, `packageType`).
6. **`ShipmentTrackingEvent`**: Append-only chronological timeline of tracking events.
