-- CreateEnum
CREATE TYPE "TaxType" AS ENUM ('VAT', 'SALES_TAX', 'GST', 'CUSTOMS_DUTY', 'WITHHOLDING', 'OTHER');

-- CreateEnum
CREATE TYPE "TaxScope" AS ENUM ('OUTPUT', 'INPUT', 'BOTH');

-- CreateEnum
CREATE TYPE "JurisdictionType" AS ENUM ('COUNTRY', 'STATE', 'CITY', 'SPECIAL_ZONE');

-- CreateEnum
CREATE TYPE "TaxRuleTransactionType" AS ENUM ('SALES', 'PURCHASING', 'BOTH');

-- CreateEnum
CREATE TYPE "TaxPeriodStatus" AS ENUM ('OPEN', 'PREPARED', 'FILED', 'LOCKED');

-- CreateTable: tax_jurisdictions
CREATE TABLE "tax_jurisdictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "country_code" VARCHAR(2) NOT NULL,
    "type" "JurisdictionType" NOT NULL DEFAULT 'COUNTRY',
    "parent_jurisdiction_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_codes
CREATE TABLE "tax_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "tax_type" "TaxType" NOT NULL DEFAULT 'VAT',
    "tax_scope" "TaxScope" NOT NULL DEFAULT 'BOTH',
    "jurisdiction_id" UUID,
    "is_exempt" BOOLEAN NOT NULL DEFAULT false,
    "is_zero_rated" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable: effective_tax_rates
CREATE TABLE "effective_tax_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "rate" DECIMAL(12,4) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "effective_to" TIMESTAMPTZ(6),
    "is_inclusive" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "effective_tax_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_rules
CREATE TABLE "tax_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "transaction_type" "TaxRuleTransactionType" NOT NULL DEFAULT 'BOTH',
    "tax_code_id" UUID NOT NULL,
    "jurisdiction_id" UUID,
    "customer_group_id" UUID,
    "customer_id" UUID,
    "supplier_id" UUID,
    "item_category_id" UUID,
    "item_id" UUID,
    "effective_from" TIMESTAMPTZ(6),
    "effective_to" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_transactions
CREATE TABLE "tax_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "tax_code_id" UUID NOT NULL,
    "jurisdiction_id" UUID,
    "journal_entry_id" UUID,
    "tax_period_id" UUID,
    "transaction_date" TIMESTAMPTZ(6) NOT NULL,
    "tax_scope" "TaxScope" NOT NULL,
    "source_type" VARCHAR(50) NOT NULL,
    "source_id" VARCHAR(100) NOT NULL,
    "source_number" VARCHAR(100),
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "taxable_amount" DECIMAL(20,4) NOT NULL,
    "tax_rate" DECIMAL(12,4) NOT NULL,
    "tax_amount" DECIMAL(20,4) NOT NULL,
    "is_reversal" BOOLEAN NOT NULL DEFAULT false,
    "reversal_of_tax_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: tax_periods
CREATE TABLE "tax_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "start_date" TIMESTAMPTZ(6) NOT NULL,
    "end_date" TIMESTAMPTZ(6) NOT NULL,
    "status" "TaxPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "total_taxable_sales" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_output_tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_taxable_purchases" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_input_tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "net_tax_payable" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "prepared_at" TIMESTAMPTZ(6),
    "prepared_by_user_id" UUID,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tax_periods_pkey" PRIMARY KEY ("id")
);

-- Indexes for tax_jurisdictions
CREATE UNIQUE INDEX "tax_jurisdictions_organization_id_code_key" ON "tax_jurisdictions"("organization_id", "code");
CREATE INDEX "tax_jurisdictions_organization_id_is_active_idx" ON "tax_jurisdictions"("organization_id", "is_active");
CREATE INDEX "tax_jurisdictions_organization_id_parent_jurisdiction_id_idx" ON "tax_jurisdictions"("organization_id", "parent_jurisdiction_id");

-- Indexes for tax_codes
CREATE UNIQUE INDEX "tax_codes_organization_id_code_key" ON "tax_codes"("organization_id", "code");
CREATE INDEX "tax_codes_organization_id_is_active_idx" ON "tax_codes"("organization_id", "is_active");
CREATE INDEX "tax_codes_organization_id_tax_type_idx" ON "tax_codes"("organization_id", "tax_type");

-- Indexes for effective_tax_rates
CREATE INDEX "effective_tax_rates_organization_id_tax_code_id_idx" ON "effective_tax_rates"("organization_id", "tax_code_id");
CREATE INDEX "effective_tax_rates_organization_id_effective_from_effective_idx" ON "effective_tax_rates"("organization_id", "effective_from", "effective_to");

-- Indexes for tax_rules
CREATE INDEX "tax_rules_organization_id_priority_idx" ON "tax_rules"("organization_id", "priority");
CREATE INDEX "tax_rules_organization_id_transaction_type_idx" ON "tax_rules"("organization_id", "transaction_type");
CREATE INDEX "tax_rules_organization_id_is_active_idx" ON "tax_rules"("organization_id", "is_active");

-- Indexes for tax_transactions
CREATE UNIQUE INDEX "tax_transactions_organization_id_source_type_source_id_tax__key" ON "tax_transactions"("organization_id", "source_type", "source_id", "tax_code_id", "is_reversal");
CREATE INDEX "tax_transactions_organization_id_transaction_date_idx" ON "tax_transactions"("organization_id", "transaction_date");
CREATE INDEX "tax_transactions_organization_id_tax_scope_idx" ON "tax_transactions"("organization_id", "tax_scope");
CREATE INDEX "tax_transactions_organization_id_tax_period_id_idx" ON "tax_transactions"("organization_id", "tax_period_id");
CREATE INDEX "tax_transactions_organization_id_tax_code_id_idx" ON "tax_transactions"("organization_id", "tax_code_id");

-- Indexes for tax_periods
CREATE UNIQUE INDEX "tax_periods_organization_id_name_key" ON "tax_periods"("organization_id", "name");
CREATE INDEX "tax_periods_organization_id_status_idx" ON "tax_periods"("organization_id", "status");
CREATE INDEX "tax_periods_organization_id_start_date_end_date_idx" ON "tax_periods"("organization_id", "start_date", "end_date");

-- Foreign keys for tax_jurisdictions
ALTER TABLE "tax_jurisdictions" ADD CONSTRAINT "tax_jurisdictions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_jurisdictions" ADD CONSTRAINT "tax_jurisdictions_parent_jurisdiction_id_fkey" FOREIGN KEY ("parent_jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for tax_codes
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_codes" ADD CONSTRAINT "tax_codes_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for effective_tax_rates
ALTER TABLE "effective_tax_rates" ADD CONSTRAINT "effective_tax_rates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "effective_tax_rates" ADD CONSTRAINT "effective_tax_rates_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign keys for tax_rules
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_customer_group_id_fkey" FOREIGN KEY ("customer_group_id") REFERENCES "customer_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_item_category_id_fkey" FOREIGN KEY ("item_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_rules" ADD CONSTRAINT "tax_rules_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for tax_transactions
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_tax_code_id_fkey" FOREIGN KEY ("tax_code_id") REFERENCES "tax_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "tax_jurisdictions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_tax_period_id_fkey" FOREIGN KEY ("tax_period_id") REFERENCES "tax_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tax_transactions" ADD CONSTRAINT "tax_transactions_reversal_of_tax_transaction_id_fkey" FOREIGN KEY ("reversal_of_tax_transaction_id") REFERENCES "tax_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for tax_periods
ALTER TABLE "tax_periods" ADD CONSTRAINT "tax_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
