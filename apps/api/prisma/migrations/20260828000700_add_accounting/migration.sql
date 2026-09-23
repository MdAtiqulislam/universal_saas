-- ==============================================================================
-- MILESTONE M12: ACCOUNTING & FINANCE FOUNDATION
-- Migration: 20260828000700_add_accounting
-- ==============================================================================

-- Create Enum Types for Accounting
CREATE TYPE "AccountType" AS ENUM (
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE'
);

CREATE TYPE "FiscalPeriodStatus" AS ENUM (
  'OPEN',
  'CLOSED'
);

CREATE TYPE "JournalEntryStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'VOIDED'
);

-- ------------------------------------------------------------------------------
-- 1. Accounts Table (Chart of Accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE "accounts" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "type" "AccountType" NOT NULL,
  "parent_id" UUID,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounts_organization_id_code_key" ON "accounts"("organization_id", "code");
CREATE INDEX "accounts_organization_id_type_idx" ON "accounts"("organization_id", "type");
CREATE INDEX "accounts_organization_id_parent_id_idx" ON "accounts"("organization_id", "parent_id");

ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounts" ADD CONSTRAINT "chk_account_no_self_parent" CHECK ("id" != "parent_id");

-- ------------------------------------------------------------------------------
-- 2. Fiscal Periods Table
-- ------------------------------------------------------------------------------
CREATE TABLE "fiscal_periods" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "FiscalPeriodStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closed_at" TIMESTAMPTZ(6),

  CONSTRAINT "fiscal_periods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fiscal_periods_organization_id_name_key" ON "fiscal_periods"("organization_id", "name");
CREATE INDEX "fiscal_periods_organization_id_status_idx" ON "fiscal_periods"("organization_id", "status");
CREATE INDEX "fiscal_periods_organization_id_start_date_end_date_idx" ON "fiscal_periods"("organization_id", "start_date", "end_date");

ALTER TABLE "fiscal_periods" ADD CONSTRAINT "fiscal_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fiscal_periods" ADD CONSTRAINT "chk_fiscal_period_dates" CHECK ("start_date" < "end_date");

-- ------------------------------------------------------------------------------
-- 3. Journal Entries Table
-- ------------------------------------------------------------------------------
CREATE TABLE "journal_entries" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "fiscal_period_id" UUID NOT NULL,
  "entry_number" VARCHAR(50) NOT NULL,
  "entry_date" DATE NOT NULL,
  "description" TEXT,
  "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
  "source_type" VARCHAR(50),
  "source_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(6),
  "posted_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journal_entries_organization_id_entry_number_key" ON "journal_entries"("organization_id", "entry_number");
CREATE INDEX "journal_entries_organization_id_status_idx" ON "journal_entries"("organization_id", "status");
CREATE INDEX "journal_entries_organization_id_fiscal_period_id_idx" ON "journal_entries"("organization_id", "fiscal_period_id");
CREATE INDEX "journal_entries_organization_id_entry_date_idx" ON "journal_entries"("organization_id", "entry_date");
CREATE INDEX "journal_entries_organization_id_source_type_source_id_idx" ON "journal_entries"("organization_id", "source_type", "source_id");

ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 4. Journal Lines Table
-- ------------------------------------------------------------------------------
CREATE TABLE "journal_lines" (
  "id" UUID NOT NULL,
  "journal_entry_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "account_id" UUID NOT NULL,
  "description" TEXT,
  "debit" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "credit" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "line_number" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "journal_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "journal_lines_organization_id_journal_entry_id_idx" ON "journal_lines"("organization_id", "journal_entry_id");
CREATE INDEX "journal_lines_organization_id_account_id_idx" ON "journal_lines"("organization_id", "account_id");

ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "journal_lines" ADD CONSTRAINT "journal_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "journal_lines" ADD CONSTRAINT "chk_journal_line_debit_non_neg" CHECK ("debit" >= 0);
ALTER TABLE "journal_lines" ADD CONSTRAINT "chk_journal_line_credit_non_neg" CHECK ("credit" >= 0);
ALTER TABLE "journal_lines" ADD CONSTRAINT "chk_journal_line_xor" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));
