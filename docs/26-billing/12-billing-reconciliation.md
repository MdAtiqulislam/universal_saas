# 12. Financial Reconciliation & Credit Ledger

## Credit Ledger & Loss Prevention

Organizations can accrue credit balances via promotional grants, manual adjustments, or plan proration credits:

- **Credit Records (`BillingCredit`)**: Store original amount, expiration timestamp, reason, and `consumedAmount`.
- **FIFO Consumption**: When creating or finalizing an invoice, the system consumes credits in First-In-First-Out order, incrementing `consumedAmount` and decrementing the invoice balance due.
- **Audit Logging**: Every credit grant records an audit event (`billing.credit.granted`) with actor metadata and reasons.
- **Discount Redemptions**: Promotional discounts (`BillingDiscount`) enforce validity windows, organization restrictions, and maximum redemptions (`maxRedemptions`), tracking redemption frequency in `timesRedeemed`.
