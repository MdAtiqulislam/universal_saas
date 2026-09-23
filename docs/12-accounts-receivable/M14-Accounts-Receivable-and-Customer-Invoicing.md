# Milestone M14: Accounts Receivable & Customer Invoicing

## 1. Overview & Architectural Scope

Milestone M14 establishes the production-grade, tenant-aware **Accounts Receivable (AR) & Customer Invoicing** foundation for the **Universal Business Operations SaaS** platform. It links sales order management and outbound deliveries (M11 Sales, M09 Inventory) with the General Ledger (M12 Accounting).

```mermaid
graph TD
    SO[Sales Order] -->|Direct Conversion| INV[Customer Invoice (Draft)]
    SO -->|Delivery Completed| DO[Delivery Order]
    DO -->|Delivery Conversion| INV
    INV -->|Review & Totals Check| ISSUE[Issue Invoice]
    ISSUE -->|Atomic GL Journal Posting| POST[M12 General Ledger]
    POST -->|Debit AR, Credit Revenue/Tax| GL[Journal Entry: POSTED]
    POST -->|Compensating Reversal| VOID[Voided Invoice & Reversal Journal]
    ISSUE -->|Real-time Calculation| BAL[Customer AR Balance]
    ISSUE -->|Aging Bucketing| AGING[AR Aging Report]
```

---

## 2. Core Entities & Database Schema

### 2.1 Customer Invoices (`CustomerInvoice`)

- **Fields**: `id`, `organization_id`, `customer_id`, `invoice_number`, `invoice_date`, `due_date`, `payment_terms_days`, `currency_id`, `status`, `subtotal`, `discount_amount`, `tax_amount`, `grand_total`, `amount_paid`, `amount_due`, `sales_order_id`, `delivery_order_id`, `notes`, `created_by_user_id`, `issued_by_user_id`, `issued_at`, `voided_at`, timestamps, `deleted_at`.
- **Constraints**:
  - `UNIQUE(organization_id, invoice_number)`
  - `grand_total >= 0`, `amount_paid >= 0`, `amount_due >= 0`
  - `amount_due = grand_total - amount_paid`

### 2.2 Customer Invoice Lines (`CustomerInvoiceLine`)

- **Fields**: `id`, `customer_invoice_id`, `organization_id`, `item_id`, `variant_id`, `sales_order_line_id`, `description`, `quantity`, `unit_price`, `discount_amount`, `tax_rate`, `tax_amount`, `line_total`, timestamps.
- **Constraints**:
  - `quantity > 0`
  - `unit_price >= 0`, `discount_amount >= 0`, `tax_amount >= 0`, `line_total >= 0`

### 2.3 Accounts Receivable Account Mapping (`AccountingAccountMapping`)

- Multi-tenant general ledger mapping configuration storing account mappings for:
  - `ACCOUNTS_RECEIVABLE` (Asset)
  - `SALES_REVENUE` (Revenue)
  - `OUTPUT_TAX` (Liability)
  - `SALES_DISCOUNT` (Revenue reduction)
- **Constraints**:
  - `UNIQUE(organization_id, key)`

---

## 3. Invoice State Machine & Lifecycle

```text
DRAFT
  ↓ (issue - creates GL entry)
ISSUED
  ↓ (payments in settlement milestone)
PARTIALLY_PAID
  ↓
PAID

Alternative Terminal Transitions:
DRAFT → CANCELLED
ISSUED → VOIDED (generates compensating GL reversal journal entry)
```

---

## 4. Source Conversions (Sales Order & Delivery Order $\to$ Invoice)

1. **Sales Order Conversion** (`POST /api/v1/customer-invoices/from-sales-order/:salesOrderId`):
   - Validates sales order is `CONFIRMED` or `DELIVERED`.
   - Copies remaining un-invoiced line quantities and prices.
   - Prevents duplicate invoicing once fully billed.
2. **Delivery Order Conversion** (`POST /api/v1/customer-invoices/from-delivery-order/:deliveryOrderId`):
   - Validates delivery order is `SHIPPED` or `DELIVERED`.
   - Creates draft invoice from delivered line quantities.

---

## 5. General Ledger Accounting Integration

When an invoice transitions to `ISSUED`, `CustomerInvoicesService` automatically creates an M12 journal entry:

- **Debit**: Accounts Receivable (`grand_total`)
- **Credit**: Sales Revenue (`subtotal - discount_amount`)
- **Credit**: Output Tax (`tax_amount`, if $> 0$)

Parity invariant: $\sum \text{Debit} == \sum \text{Credit} == \text{grand\_total}$.

---

## 6. Accounts Receivable Balances & Aging Report

1. **Customer AR Balance** (`GET /api/v1/receivables/customers/:customerId`):
   - Calculates `totalInvoiced`, `totalPaid`, `totalDue`, `overdueAmount`, and `openInvoiceCount`.
2. **AR Aging Report** (`GET /api/v1/receivables/aging`):
   - Categorizes outstanding amounts by days past due from `dueDate`:
     - `Current` (not overdue)
     - `1–30 days`
     - `31–60 days`
     - `61–90 days`
     - `90+ days`
   - Generates tenant aggregate totals and individual customer breakdowns.

---

## 7. RBAC Permissions Matrix

| Permission Key            | Role Assignment            | Description                                            |
| :------------------------ | :------------------------- | :----------------------------------------------------- |
| `sales.invoices.view`     | `OWNER`, `ADMIN`, `VIEWER` | View customer invoices and line details                |
| `sales.invoices.manage`   | `OWNER`, `ADMIN`           | Create and update draft customer invoices              |
| `sales.invoices.issue`    | `OWNER`, `ADMIN`           | Issue customer invoices and post to general ledger     |
| `sales.invoices.void`     | `OWNER`, `ADMIN`           | Void issued customer invoices with accounting reversal |
| `sales.receivables.view`  | `OWNER`, `ADMIN`, `VIEWER` | View accounts receivable customer balances             |
| `sales.receivables.aging` | `OWNER`, `ADMIN`, `VIEWER` | View accounts receivable aging reports                 |

---

## 8. API Endpoints

### Invoices

- `GET /api/v1/customer-invoices` — List customer invoices (search, filters, pagination)
- `POST /api/v1/customer-invoices` — Create draft invoice
- `GET /api/v1/customer-invoices/:id` — Get customer invoice details with lines
- `PATCH /api/v1/customer-invoices/:id` — Update draft customer invoice
- `DELETE /api/v1/customer-invoices/:id` — Delete draft customer invoice
- `POST /api/v1/customer-invoices/:id/issue` — Issue invoice and post to General Ledger
- `POST /api/v1/customer-invoices/:id/cancel` — Cancel draft invoice
- `POST /api/v1/customer-invoices/:id/void` — Void issued invoice with GL reversal
- `POST /api/v1/customer-invoices/from-sales-order/:salesOrderId` — Create invoice from Sales Order
- `POST /api/v1/customer-invoices/from-delivery-order/:deliveryOrderId` — Create invoice from Delivery Order

### Receivables & Aging

- `GET /api/v1/receivables/customers/:customerId` — Get customer AR balance & overdue amount
- `GET /api/v1/receivables/aging` — Get tenant AR aging report
