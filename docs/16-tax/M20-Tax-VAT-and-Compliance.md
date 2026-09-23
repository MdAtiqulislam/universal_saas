# Milestone M20 — Tax, VAT & Compliance Foundation

## 1. Overview & Architecture

Milestone M20 delivers a dedicated, multi-tenant tax calculation, compliance ledger, and period reporting system for the Universal Business Operations SaaS platform. It decouples tax logic from core commerce workflows (Sales Orders, Invoices, Purchase Orders, Debit/Credit Notes) into a centralized, configurable tax engine.

```
┌────────────────────────────────────────────────────────────┐
│                    Tax Calculation Engine                  │
│   (Precedence: Direct Override -> Specific Rules -> Default)│
└──────────────────────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐              ┌────────────────────┐
│  Tax Codes & Rates     │              │  Tax Jurisdictions │
│ (Effective-dated rates)│              │  (Tree hierarchy)  │
└────────────────────────┘              └────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────┐
│              Authoritative Tax Ledger                      │
│             (`tax_transactions` table)                    │
│   - Immutable history                                      │
│   - Double-entry GL integration                            │
│   - Period locking protection                              │
└──────────────────────────────┬─────────────────────────────┘
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
┌────────────────────────┐              ┌────────────────────┐
│  Tax Period Management │              │  Tax Reports       │
│ (OPEN/PREPARED/LOCKED) │              │ (Output/Input/Net) │
└────────────────────────┘              └────────────────────┘
```

---

## 2. Key Components

### 2.1 Tax Codes & Effective-Dated Rates

- **Tax Codes**: Represents tax classifications such as `STANDARD_VAT`, `ZERO_RATED`, `EXEMPT`, `OUT_OF_SCOPE`.
- **Effective Rates**: Time-sliced tax rates (`effectiveFrom` to `effectiveTo`) supporting inclusive or exclusive price calculation. Overlapping date ranges for the same tax code are strictly rejected.

### 2.2 Tax Jurisdictions

- Hierarchical tree structure supporting `COUNTRY`, `STATE`, `CITY`, and `SPECIAL_ZONE`.
- Self-referencing tree prevents circular parent-child loops.

### 2.3 Deterministic Rule Precedence

The rule engine evaluates rules in ascending priority order:

1. Direct Tax Code Override.
2. Customer/Supplier + Item + Jurisdiction.
3. Customer/Supplier + Item Category.
4. Customer Group + Item + Jurisdiction.
5. Item + Jurisdiction.
6. Item Category + Jurisdiction.
7. Jurisdiction Default.
8. Organization Default Tax Code.

### 2.4 Authoritative Tax Ledger & GL Integration

- All tax events are recorded in `tax_transactions` with full tenant isolation and idempotency.
- Automatically generates balanced General Ledger journal entries for `OUTPUT_TAX` (sales) and `INPUT_TAX` (purchases) using configured account mappings.

### 2.5 Tax Periods & Compliance Locking

- **OPEN**: Active transactions are continuously posted.
- **PREPARED**: Summaries are computed ($\text{Net Tax} = \text{Output Tax} - \text{Input Tax}$) and linked to the period.
- **LOCKED**: Finalized. No further transactions can be posted directly into the locked period's date window.

---

## 3. REST API Reference

| Method | Endpoint                          | Permission                 | Description               |
| :----- | :-------------------------------- | :------------------------- | :------------------------ |
| `GET`  | `/api/v1/tax/codes`               | `tax.codes.view`           | List tenant tax codes     |
| `POST` | `/api/v1/tax/codes`               | `tax.codes.manage`         | Create tax code           |
| `GET`  | `/api/v1/tax/rates`               | `tax.rates.view`           | List effective tax rates  |
| `POST` | `/api/v1/tax/rates`               | `tax.rates.manage`         | Create effective tax rate |
| `GET`  | `/api/v1/tax/jurisdictions`       | `tax.jurisdictions.view`   | List tax jurisdictions    |
| `POST` | `/api/v1/tax/jurisdictions`       | `tax.jurisdictions.manage` | Create tax jurisdiction   |
| `GET`  | `/api/v1/tax/rules`               | `tax.rules.view`           | List tax rules            |
| `POST` | `/api/v1/tax/rules`               | `tax.rules.manage`         | Create tax rule           |
| `POST` | `/api/v1/tax/calculate`           | `tax.calculation.view`     | Calculate tax lines       |
| `GET`  | `/api/v1/tax/reports/summary`     | `tax.reports.view`         | Executive tax summary     |
| `GET`  | `/api/v1/tax/reports/output-tax`  | `tax.reports.view`         | Output tax report         |
| `GET`  | `/api/v1/tax/reports/input-tax`   | `tax.reports.view`         | Input tax report          |
| `GET`  | `/api/v1/tax/periods`             | `tax.periods.view`         | List tax filing periods   |
| `POST` | `/api/v1/tax/periods`             | `tax.periods.manage`       | Create tax filing period  |
| `POST` | `/api/v1/tax/periods/:id/prepare` | `tax.periods.manage`       | Prepare period summary    |
| `POST` | `/api/v1/tax/periods/:id/lock`    | `tax.periods.lock`         | Lock tax filing period    |
