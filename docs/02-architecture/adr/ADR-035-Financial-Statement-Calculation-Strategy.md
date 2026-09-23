# ADR-035: Financial Statement Calculation Strategy

## Status

Accepted

## Context

Financial statements (Balance Sheet, Income Statement / Profit & Loss, and Cash Flow) must reflect standard double-entry accounting principles across user-defined date ranges and fiscal periods.

## Decision

1. **Balance Sheet**:
   - Assets = $\sum (D - C)$ for Asset accounts.
   - Liabilities = $\sum (C - D)$ for Liability accounts.
   - Equity = $\sum (C - D)$ for Equity accounts + Current Period Net Income.
   - Strictly enforces the fundamental accounting equation: $\text{Assets} = \text{Liabilities} + \text{Equity}$.
2. **Income Statement**:
   - Revenue = $\sum (C - D)$ for Revenue accounts within the reporting period.
   - Expenses = $\sum (D - C)$ for Expense accounts within the reporting period.
   - Net Income = $\text{Total Revenue} - \text{Total Expenses}$.
3. **Cash Flow Statement Foundation**:
   - Reconciles cash and bank account movements into Operating, Investing, and Financing activities.
   - Net change in cash matches the change between opening and closing cash balances.

## Consequences

- Produces mathematically balanced financial statements for any valid date window.
- Fully supports fiscal period boundaries and ad-hoc date ranges.
