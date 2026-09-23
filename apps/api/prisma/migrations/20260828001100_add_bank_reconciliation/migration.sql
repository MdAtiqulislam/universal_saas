-- ==============================================================================
-- MILESTONE M16: BANK RECONCILIATION & CASH MANAGEMENT FOUNDATION
-- Migration: 20260828001100_add_bank_reconciliation
-- ==============================================================================

-- Create Enum Types for Bank Reconciliation
CREATE TYPE "BankStatementStatus" AS ENUM (
  'DRAFT',
  'IMPORTED',
  'RECONCILING',
  'RECONCILED',
  'LOCKED'
);

CREATE TYPE "BankTransactionStatus" AS ENUM (
  'UNMATCHED',
  'POSSIBLE_MATCH',
  'MATCHED',
  'ADJUSTED',
  'IGNORED'
);

CREATE TYPE "BankReconciliationStatus" AS ENUM (
  'OPEN',
  'COMPLETED',
  'CANCELLED'
);

-- ------------------------------------------------------------------------------
-- 1. Bank Account Profiles Table
-- ------------------------------------------------------------------------------
CREATE TABLE "bank_account_profiles" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "payment_account_id" UUID NOT NULL,
  "bank_name" VARCHAR(100) NOT NULL,
  "branch_name" VARCHAR(100),
  "account_number_masked" VARCHAR(50) NOT NULL,
  "account_holder_name" VARCHAR(100) NOT NULL,
  "routing_number" VARCHAR(50),
  "currency_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "bank_account_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_account_profiles_payment_account_id_key" ON "bank_account_profiles"("payment_account_id");
CREATE UNIQUE INDEX "bank_account_profiles_organization_id_payment_account_id_key" ON "bank_account_profiles"("organization_id", "payment_account_id");
CREATE UNIQUE INDEX "bank_account_profiles_organization_id_account_number_masked_key" ON "bank_account_profiles"("organization_id", "account_number_masked");

ALTER TABLE "bank_account_profiles" ADD CONSTRAINT "bank_account_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_account_profiles" ADD CONSTRAINT "bank_account_profiles_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_account_profiles" ADD CONSTRAINT "bank_account_profiles_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 2. Bank Statements Table
-- ------------------------------------------------------------------------------
CREATE TABLE "bank_statements" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "payment_account_id" UUID NOT NULL,
  "statement_number" VARCHAR(50) NOT NULL,
  "statement_date" DATE NOT NULL,
  "opening_balance" DECIMAL(20, 4) NOT NULL,
  "closing_balance" DECIMAL(20, 4) NOT NULL,
  "currency_id" UUID NOT NULL,
  "status" "BankStatementStatus" NOT NULL DEFAULT 'DRAFT',
  "source" VARCHAR(50),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bank_statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_statements_organization_id_statement_number_key" ON "bank_statements"("organization_id", "statement_number");
CREATE INDEX "bank_statements_organization_id_payment_account_id_idx" ON "bank_statements"("organization_id", "payment_account_id");
CREATE INDEX "bank_statements_organization_id_statement_date_idx" ON "bank_statements"("organization_id", "statement_date");
CREATE INDEX "bank_statements_organization_id_status_idx" ON "bank_statements"("organization_id", "status");

ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_statements" ADD CONSTRAINT "bank_statements_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 3. Bank Statement Transactions Table
-- ------------------------------------------------------------------------------
CREATE TABLE "bank_statement_transactions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "bank_statement_id" UUID NOT NULL,
  "transaction_date" DATE NOT NULL,
  "value_date" DATE,
  "description" VARCHAR(255) NOT NULL,
  "reference" VARCHAR(100),
  "external_transaction_id" VARCHAR(100),
  "debit_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "credit_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "amount" DECIMAL(20, 4) NOT NULL,
  "running_balance" DECIMAL(20, 4),
  "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
  "matched_payment_id" UUID,
  "matched_journal_entry_id" UUID,
  "reconciliation_date" TIMESTAMPTZ(6),
  "reconciled_by_user_id" UUID,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bank_statement_transactions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_statement_transactions_organization_id_bank_statement_idx" ON "bank_statement_transactions"("organization_id", "bank_statement_id");
CREATE INDEX "bank_statement_transactions_bank_statement_id_transaction_d_idx" ON "bank_statement_transactions"("bank_statement_id", "transaction_date");
CREATE INDEX "bank_statement_transactions_bank_statement_id_status_idx" ON "bank_statement_transactions"("bank_statement_id", "status");
CREATE INDEX "bank_statement_transactions_organization_id_matched_payment_idx" ON "bank_statement_transactions"("organization_id", "matched_payment_id");
CREATE INDEX "bank_statement_transactions_organization_id_external_transa_idx" ON "bank_statement_transactions"("organization_id", "external_transaction_id");

ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_bank_statement_id_fkey" FOREIGN KEY ("bank_statement_id") REFERENCES "bank_statements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_matched_payment_id_fkey" FOREIGN KEY ("matched_payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "bank_statement_transactions_matched_journal_entry_id_fkey" FOREIGN KEY ("matched_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "chk_bank_stmt_txn_amounts" CHECK ("amount" > 0 AND "debit_amount" >= 0 AND "credit_amount" >= 0);
ALTER TABLE "bank_statement_transactions" ADD CONSTRAINT "chk_bank_stmt_txn_debit_credit_xor" CHECK (
  ("debit_amount" > 0 AND "credit_amount" = 0 AND "amount" = "debit_amount") OR
  ("credit_amount" > 0 AND "debit_amount" = 0 AND "amount" = "credit_amount")
);

-- ------------------------------------------------------------------------------
-- 4. Bank Reconciliations Table
-- ------------------------------------------------------------------------------
CREATE TABLE "bank_reconciliations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "reconciliation_number" VARCHAR(50) NOT NULL,
  "payment_account_id" UUID NOT NULL,
  "statement_id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "book_balance" DECIMAL(20, 4) NOT NULL,
  "statement_balance" DECIMAL(20, 4) NOT NULL,
  "reconciled_balance" DECIMAL(20, 4) NOT NULL,
  "difference" DECIMAL(20, 4) NOT NULL,
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'OPEN',
  "started_by_user_id" UUID NOT NULL,
  "completed_by_user_id" UUID,
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "bank_reconciliations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "bank_reconciliations_statement_id_key" ON "bank_reconciliations"("statement_id");
CREATE UNIQUE INDEX "bank_reconciliations_organization_id_reconciliation_number_key" ON "bank_reconciliations"("organization_id", "reconciliation_number");
CREATE UNIQUE INDEX "bank_reconciliations_organization_id_statement_id_key" ON "bank_reconciliations"("organization_id", "statement_id");
CREATE INDEX "bank_reconciliations_organization_id_payment_account_id_idx" ON "bank_reconciliations"("organization_id", "payment_account_id");
CREATE INDEX "bank_reconciliations_organization_id_status_idx" ON "bank_reconciliations"("organization_id", "status");

ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bank_reconciliations" ADD CONSTRAINT "bank_reconciliations_statement_id_fkey" FOREIGN KEY ("statement_id") REFERENCES "bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
