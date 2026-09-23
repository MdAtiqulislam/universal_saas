-- ==============================================================================
-- MILESTONE M15: PAYMENTS, RECEIPTS & SETTLEMENT FOUNDATION
-- Migration: 20260828001000_add_payments_and_settlement
-- ==============================================================================

-- Create Enum Types for Payments & Settlement
CREATE TYPE "PaymentAccountType" AS ENUM (
  'CASH',
  'BANK',
  'MOBILE_WALLET',
  'OTHER'
);

CREATE TYPE "PaymentType" AS ENUM (
  'RECEIPT',
  'PAYMENT'
);

CREATE TYPE "PaymentStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'PARTIALLY_ALLOCATED',
  'ALLOCATED',
  'VOIDED'
);

-- ------------------------------------------------------------------------------
-- 1. Payment Accounts Table
-- ------------------------------------------------------------------------------
CREATE TABLE "payment_accounts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "type" "PaymentAccountType" NOT NULL,
  "currency_id" UUID NOT NULL,
  "accounting_account_id" UUID NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_accounts_organization_id_code_key" ON "payment_accounts"("organization_id", "code");
CREATE INDEX "payment_accounts_organization_id_is_active_idx" ON "payment_accounts"("organization_id", "is_active");
CREATE INDEX "payment_accounts_organization_id_type_idx" ON "payment_accounts"("organization_id", "type");

ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_accounts" ADD CONSTRAINT "payment_accounts_accounting_account_id_fkey" FOREIGN KEY ("accounting_account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 2. Payments Table
-- ------------------------------------------------------------------------------
CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "payment_number" VARCHAR(50) NOT NULL,
  "type" "PaymentType" NOT NULL,
  "payment_account_id" UUID NOT NULL,
  "currency_id" UUID NOT NULL,
  "customer_id" UUID,
  "supplier_id" UUID,
  "payment_date" DATE NOT NULL,
  "amount" DECIMAL(20, 4) NOT NULL,
  "allocated_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "unallocated_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "reference" VARCHAR(100),
  "notes" TEXT,
  "status" "PaymentStatus" NOT NULL DEFAULT 'DRAFT',
  "created_by_user_id" UUID NOT NULL,
  "posted_by_user_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "journal_entry_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_organization_id_payment_number_key" ON "payments"("organization_id", "payment_number");
CREATE INDEX "payments_organization_id_type_idx" ON "payments"("organization_id", "type");
CREATE INDEX "payments_organization_id_status_idx" ON "payments"("organization_id", "status");
CREATE INDEX "payments_organization_id_customer_id_idx" ON "payments"("organization_id", "customer_id");
CREATE INDEX "payments_organization_id_supplier_id_idx" ON "payments"("organization_id", "supplier_id");
CREATE INDEX "payments_organization_id_payment_account_id_idx" ON "payments"("organization_id", "payment_account_id");
CREATE INDEX "payments_organization_id_payment_date_idx" ON "payments"("organization_id", "payment_date");

ALTER TABLE "payments" ADD CONSTRAINT "payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "payments" ADD CONSTRAINT "chk_payment_amounts" CHECK ("amount" > 0 AND "allocated_amount" >= 0 AND "unallocated_amount" >= 0 AND "allocated_amount" <= "amount");
ALTER TABLE "payments" ADD CONSTRAINT "chk_payment_balance" CHECK ("unallocated_amount" = "amount" - "allocated_amount");

-- ------------------------------------------------------------------------------
-- 3. Payment Allocations Table
-- ------------------------------------------------------------------------------
CREATE TABLE "payment_allocations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "customer_invoice_id" UUID,
  "supplier_invoice_id" UUID,
  "amount" DECIMAL(20, 4) NOT NULL,
  "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payment_allocations_organization_id_payment_id_idx" ON "payment_allocations"("organization_id", "payment_id");
CREATE INDEX "payment_allocations_organization_id_customer_invoice_id_idx" ON "payment_allocations"("organization_id", "customer_invoice_id");
CREATE INDEX "payment_allocations_organization_id_supplier_invoice_id_idx" ON "payment_allocations"("organization_id", "supplier_invoice_id");

ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations" ADD CONSTRAINT "chk_payment_allocation_amount" CHECK ("amount" > 0);
ALTER TABLE "payment_allocations" ADD CONSTRAINT "chk_payment_allocation_target_xor" CHECK (
  ("customer_invoice_id" IS NOT NULL AND "supplier_invoice_id" IS NULL) OR
  ("customer_invoice_id" IS NULL AND "supplier_invoice_id" IS NOT NULL)
);
