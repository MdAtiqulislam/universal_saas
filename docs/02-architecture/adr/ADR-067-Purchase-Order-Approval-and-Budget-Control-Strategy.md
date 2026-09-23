# ADR-067: Purchase Order Approval and Budget Control Strategy

## Status

Accepted

## Context

Purchase Orders represent financial commitments made by a tenant to external suppliers. Before formal issuance to vendors, purchase orders must pass tenant validation rules and undergo budget authorization without duplicating the budget calculation engine developed in Milestone M23.

## Decision

1. **Reuse M23 Budget Control Engine**:
   - `ProcurementPurchaseOrdersService` integrates with `BudgetControlService.checkBudgetAvailability`.
   - PO grand total is verified against active fiscal period budgets for the corresponding expense/asset accounts.
2. **Policy Enforcement**:
   - `CHECK_ONLY`: Records budget check event in audit logs, permits approval.
   - `WARN`: Emits `PURCHASE_ORDER_BUDGET_EXCEEDED` domain event, logs warning, and permits approval.
   - `BLOCK`: Emits `PURCHASE_ORDER_BUDGET_EXCEEDED` domain event and throws `BadRequestException` to block approval.
3. **Approval Lifecycle**:
   - Only `DRAFT` or `SUBMITTED` orders can be approved.
   - Sets `status = APPROVED`, `approvedByUserId`, and `approvedAt`.
   - Sent status transitions to `SENT` and supplier acknowledgement records delivery date commitments in `ACKNOWLEDGED`.

## Consequences

- Single authoritative budget control engine across accounts payable, payroll, and procurement.
- Granular permission `procurement.orders.approve` enforces segregation of duties between purchasers and approvers.
