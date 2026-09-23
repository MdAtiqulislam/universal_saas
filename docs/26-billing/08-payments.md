# 08. Payment Records & Settlement

## Payment Lifecycle & Protection (INV-448)

The `InvoicesService.applyPayment` method records settlement transactions:

- Validates that the invoice belongs to the executing tenant context (`INV-444`).
- Verifies that payment amount does not exceed invoice `amountDue` (`INV-448`), preventing accidental overbilling.
- Creates an immutable `BillingPayment` transaction record referencing the payment gateway ID (`providerTransactionId`) and provider key (`providerKey`).
- Atomically updates `amountPaid` and recalculates `amountDue`.
- Automatically marks the invoice as `PAID` when balance due reaches zero.
- Emits domain event `billing.payment.succeeded` and audit log `billing.payment.applied`.
