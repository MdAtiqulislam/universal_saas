# M17 — Financial Reporting & Trial Balance Foundation

## 1. Overview

Milestone **M17** establishes the **Financial Reporting & Trial Balance** foundation for the Universal Business Operations SaaS platform. It provides tenant-isolated financial statement generation, general ledger drill-downs, trial balance validation, balance sheets, profit and loss statements, and cash flow reporting directly derived from authoritative posted general ledger journal entries.

---

## 2. Core Architecture

```
                    +------------------------------------------+
                    |    Authoritative Posted General Ledger   |
                    |       (JournalEntry + JournalLine)       |
                    +--------------------+---------------------+
                                         |
               +-------------------------+-------------------------+
               |                         |                         |
               v                         v                         v
   +----------------------+    +-------------------+    +--------------------+
   |    Trial Balance     |    |   General Ledger  |    |  Account Balance   |
   | - Debits == Credits  |    | - Running Balance |    | - Opening, Debits, |
   | - Per-Account net    |    | - Chronological   |    |   Credits, Closing |
   +----------------------+    +-------------------+    +--------------------+
               |                         |                         |
               +-------------------------+-------------------------+
                                         |
               +-------------------------+-------------------------+
               |                         |                         |
               v                         v                         v
   +----------------------+    +-------------------+    +--------------------+
   |    Balance Sheet     |    |  Income Statement |    |     Cash Flow      |
   | - Assets             |    | - Revenue         |    | - Operating        |
   | - Liabilities        |    | - Expenses        |    | - Investing        |
   | - Equity + NetIncome |    | - Net Income      |    | - Financing        |
   | - Assets = L + E     |    | - Rev - Exp = NI  |    | - Net Cash Change  |
   +----------------------+    +-------------------+    +--------------------+
```

---

## 3. Financial Statements & Formulas

### 3.1 Trial Balance

- **Opening Balances**: Aggregates posted journal lines with `entryDate < startDate`.
- **Period Movements**: Aggregates posted journal lines with `startDate <= entryDate <= endDate`.
- **Closing Balances**: `closingDebit = openingDebit + periodDebit`, `closingCredit = openingCredit + periodCredit`.
- **Normal Balances**:
  - `ASSET`, `EXPENSE`: `closingDebit - closingCredit` (Normal Debit)
  - `LIABILITY`, `EQUITY`, `REVENUE`: `closingCredit - closingDebit` (Normal Credit)
- **Integrity Validation**: $\sum \text{Closing Debits} = \sum \text{Closing Credits}$.

### 3.2 Balance Sheet

- **Cumulative as of Date**: Considers all posted journal entries up to `asOfDate`.
- **Assets**: $\sum (\text{Debits} - \text{Credits})$ for all `ASSET` accounts.
- **Liabilities**: $\sum (\text{Credits} - \text{Debits})$ for all `LIABILITY` accounts.
- **Equity**: $\sum (\text{Credits} - \text{Debits})$ for all `EQUITY` accounts + $\text{Current Period Net Income}$.
- **Equation**: $\text{Total Assets} = \text{Total Liabilities} + \text{Total Equity}$.

### 3.3 Income Statement / Profit & Loss

- **Period Specific**: Considers posted journal entries within `[startDate, endDate]`.
- **Revenue**: $\sum (\text{Credits} - \text{Debits})$ for all `REVENUE` accounts.
- **Expenses**: $\sum (\text{Debits} - \text{Credits})$ for all `EXPENSE` accounts.
- **Net Income**: $\text{Total Revenue} - \text{Total Expenses}$.

### 3.4 Cash Flow Foundation

- **Operating Activities**: Cash inflows and outflows from core operations (Customer Receipts, Supplier Payments, Operating Expenses).
- **Investing Activities**: Fixed asset transactions and capital investments.
- **Financing Activities**: Equity contributions and loans.
- **Net Cash Change**: $\text{Operating} + \text{Investing} + \text{Financing} = \text{Closing Cash} - \text{Opening Cash}$.

---

## 4. Reversal & Voiding Handling

- In M12, voiding a posted entry creates a balanced compensating reversal journal entry (`sourceType: 'REVERSAL'`).
- In M17, both original and reversal entries belong to the posted general ledger.
- Their debits and credits naturally cancel each other out in the Trial Balance, Balance Sheet, and Income Statement without requiring special-case exclusions.

---

## 5. RBAC & Security

- `accounting.reports.view`
- `accounting.trial-balance.view`
- `accounting.general-ledger.view`
- `accounting.balance-sheet.view`
- `accounting.income-statement.view`
- `accounting.cash-flow.view`
