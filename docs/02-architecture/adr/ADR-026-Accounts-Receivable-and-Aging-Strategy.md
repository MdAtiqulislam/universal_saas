# ADR-026: Accounts Receivable Balance and Aging Bucketing Strategy

## Status

Accepted

## Context

Finance operations require real-time visibility into customer balances and aging risk analysis without scanning unrelated database tables or calculating floating-point metrics in client applications.

## Decision

### 1. Customer AR Balance Engine

Calculated directly from issued/partially paid invoice records using `DECIMAL(20, 4)`:
$$\text{totalInvoiced} = \sum \text{grandTotal}$$
$$\text{totalPaid} = \sum \text{amountPaid}$$
$$\text{totalDue} = \sum \text{amountDue}$$
$$\text{overdueAmount} = \sum \text{amountDue} \quad \text{where } \text{dueDate} < \text{NOW}()$$

### 2. AR Aging Buckets

Categorized by calendar days past due:

- **Current**: $\text{daysPastDue} \le 0$
- **1–30 Days**: $1 \le \text{daysPastDue} \le 30$
- **31–60 Days**: $31 \le \text{daysPastDue} \le 60$
- **61–90 Days**: $61 \le \text{daysPastDue} \le 90$
- **90+ Days**: $\text{daysPastDue} > 90$

## Consequences

- **Positive**: Consistent, exact monetary metrics for credit control and cashflow forecasting.
- **Negative**: Dynamic queries require indexed `dueDate` and `status` columns for performance at scale.
