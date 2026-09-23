# M16 — Bank Reconciliation & Cash Management Foundation

## 1. Overview

Milestone **M16** establishes the **Bank Reconciliation & Cash Management** foundation for the Universal Business Operations SaaS platform. It provides tenant-isolated cash account metadata, bank statement import, automated and manual transaction matching against existing Payments (M15) and General Ledger Journal Entries (M12), bank adjustment postings (fees and interest), and reconciliation sessions.

---

## 2. Core Architecture

```
                               +-----------------------------+
                               |     PaymentAccount (M15)    |
                               +--------------+--------------+
                                              |
                     +------------------------+------------------------+
                     |                                                 |
                     v                                                 v
        +--------------------------+                      +--------------------------+
        |    BankAccountProfile    |                      |      BankStatement       |
        |  - masked account number |                      |  - statementDate         |
        |  - bank / branch name    |                      |  - openingBalance (Dec)  |
        |  - routing number        |                      |  - closingBalance (Dec)  |
        +--------------------------+                      +------------+-------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        |  BankStatementTransaction   |
                                                        |  - debitAmount XOR credit   |
                                                        |  - amount > 0               |
                                                        |  - matchedPaymentId (M15)   |
                                                        |  - matchedJournalEntryId    |
                                                        +--------------+--------------+
                                                                       |
                                                                       v
                                                        +-----------------------------+
                                                        |     BankReconciliation      |
                                                        |  - REC-000001               |
                                                        |  - bookBalance / statement  |
                                                        |  - difference = 0           |
                                                        |  - status: OPEN -> LOCKED   |
                                                        +-----------------------------+
```

---

## 3. Data Invariants & Database Constraints

1. **Debit/Credit XOR Invariant**:
   - `chk_bank_stmt_txn_amounts`: `amount > 0 AND debit_amount >= 0 AND credit_amount >= 0`
   - `chk_bank_stmt_txn_debit_credit_xor`: `(debit_amount > 0 AND credit_amount = 0 AND amount = debit_amount) OR (credit_amount > 0 AND debit_amount = 0 AND amount = credit_amount)`
2. **Masked Bank Account Uniqueness**:
   - `UNIQUE(organization_id, account_number_masked)`
   - `UNIQUE(organization_id, payment_account_id)`
3. **Statement Lifecycle**:
   - `DRAFT` $\to$ `IMPORTED` $\to$ `RECONCILING` $\to$ `RECONCILED` $\to$ `LOCKED`.
4. **Statement Reconciliation Session Uniqueness**:
   - `UNIQUE(organization_id, statement_id)`: Exactly one active reconciliation session per statement.
5. **Deterministic Payment Matching**:
   - Verifies tenant ownership, payment account match, currency match, exact amount equality, and single-match constraint.

---

## 4. Bank Adjustments & GL Integration

Transactions originating from the bank statement that are not pre-recorded in the GL (such as bank maintenance charges, wire fees, or interest credits) are posted via `AccountingPostingService` without bypassing M12:

- **Bank Charge (Debit on bank statement)**:
  - Debit: Selected Expense Account (e.g., Bank Fees `6050`)
  - Credit: Payment Account General Ledger Asset Account
- **Bank Interest (Credit on bank statement)**:
  - Debit: Payment Account General Ledger Asset Account
  - Credit: Selected Income Account (e.g., Interest Income `7010`)
- The created journal entry is linked directly to `BankStatementTransaction.matchedJournalEntryId`, and the transaction is marked `ADJUSTED`.

---

## 5. Security & RBAC

- `banking.accounts.view`, `banking.accounts.manage`
- `banking.statements.view`, `banking.statements.import`, `banking.statements.manage`
- `banking.reconciliation.view`, `banking.reconciliation.manage`, `banking.reconciliation.match`, `banking.reconciliation.complete`
- `banking.adjustments.manage`
