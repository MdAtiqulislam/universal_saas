-- AlterEnum
ALTER TYPE "PaymentType" ADD VALUE IF NOT EXISTS 'REIMBURSEMENT';

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'POSTED', 'PAID', 'CLOSED', 'VOIDED');

-- CreateTable: expense_categories
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "gl_account_id" UUID,
    "tax_code_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable: expense_claimants
CREATE TABLE "expense_claimants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_number" VARCHAR(50),
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "department" VARCHAR(100),
    "default_payment_account_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "expense_claimants_pkey" PRIMARY KEY ("id")
);

-- CreateTable: expense_claims
CREATE TABLE "expense_claims" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "claim_number" VARCHAR(50) NOT NULL,
    "claimant_id" UUID NOT NULL,
    "claim_date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "currency_id" UUID NOT NULL,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "approved_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "due_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "rejection_reason" TEXT,
    "posted_at" TIMESTAMPTZ(6),
    "posted_by_user_id" UUID,
    "paid_at" TIMESTAMPTZ(6),
    "journal_entry_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable: expense_claim_lines
CREATE TABLE "expense_claim_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "expense_claim_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(20,4) NOT NULL,
    "subtotal" DECIMAL(20,4) NOT NULL,
    "tax_code_id" UUID,
    "tax_rate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(20,4) NOT NULL,
    "gl_account_id" UUID,
    "receipt_reference" VARCHAR(255),
    "receipt_filename" VARCHAR(255),
    "receipt_mime_type" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable: expense_receipts
CREATE TABLE "expense_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "expense_claim_id" UUID NOT NULL,
    "expense_claim_line_id" UUID,
    "filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_key" VARCHAR(500) NOT NULL,
    "file_size" INTEGER,
    "uploaded_by_user_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_receipts_pkey" PRIMARY KEY ("id")
);

-- AlterTable: payments
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "claimant_id" UUID;

-- AlterTable: payment_allocations
ALTER TABLE "payment_allocations" ADD COLUMN IF NOT EXISTS "expense_claim_id" UUID;

-- Indexes for expense_categories
CREATE UNIQUE INDEX "expense_categories_organization_id_code_key" ON "expense_categories"("organization_id", "code");
CREATE INDEX "expense_categories_organization_id_is_active_idx" ON "expense_categories"("organization_id", "is_active");

-- Indexes for expense_claimants
CREATE UNIQUE INDEX "expense_claimants_organization_id_employee_number_key" ON "expense_claimants"("organization_id", "employee_number");
CREATE INDEX "expense_claimants_organization_id_user_id_idx" ON "expense_claimants"("organization_id", "user_id");
CREATE INDEX "expense_claimants_organization_id_is_active_idx" ON "expense_claimants"("organization_id", "is_active");

-- Indexes for expense_claims
CREATE UNIQUE INDEX "expense_claims_organization_id_claim_number_key" ON "expense_claims"("organization_id", "claim_number");
CREATE INDEX "expense_claims_organization_id_status_idx" ON "expense_claims"("organization_id", "status");
CREATE INDEX "expense_claims_organization_id_claimant_id_idx" ON "expense_claims"("organization_id", "claimant_id");
CREATE INDEX "expense_claims_organization_id_claim_date_idx" ON "expense_claims"("organization_id", "claim_date");

-- Indexes for expense_claim_lines
CREATE INDEX "expense_claim_lines_organization_id_expense_claim_id_idx" ON "expense_claim_lines"("organization_id", "expense_claim_id");
CREATE INDEX "expense_claim_lines_organization_id_category_id_idx" ON "expense_claim_lines"("organization_id", "category_id");

-- Indexes for expense_receipts
CREATE INDEX "expense_receipts_organization_id_expense_claim_id_idx" ON "expense_receipts"("organization_id", "expense_claim_id");
CREATE INDEX "expense_receipts_organization_id_expense_claim_line_id_idx" ON "expense_receipts"("organization_id", "expense_claim_line_id");

-- Indexes for payments
CREATE INDEX "payments_organization_id_claimant_id_idx" ON "payments"("organization_id", "claimant_id");

-- Indexes for payment_allocations
CREATE INDEX "payment_allocations_organization_id_expense_claim_id_idx" ON "payment_allocations"("organization_id", "expense_claim_id");

-- Foreign keys for expense_categories
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_categories" ADD CONSTRAINT "expense_categories_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for expense_claimants
ALTER TABLE "expense_claimants" ADD CONSTRAINT "expense_claimants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_claimants" ADD CONSTRAINT "expense_claimants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_claimants" ADD CONSTRAINT "expense_claimants_default_payment_account_id_fkey" FOREIGN KEY ("default_payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for expense_claims
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "expense_claimants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_claims" ADD CONSTRAINT "expense_claims_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for expense_claim_lines
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_claim_lines" ADD CONSTRAINT "expense_claim_lines_gl_account_id_fkey" FOREIGN KEY ("gl_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for expense_receipts
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_expense_claim_line_id_fkey" FOREIGN KEY ("expense_claim_line_id") REFERENCES "expense_claim_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for payments & allocations
ALTER TABLE "payments" ADD CONSTRAINT "payments_claimant_id_fkey" FOREIGN KEY ("claimant_id") REFERENCES "expense_claimants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_expense_claim_id_fkey" FOREIGN KEY ("expense_claim_id") REFERENCES "expense_claims"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
