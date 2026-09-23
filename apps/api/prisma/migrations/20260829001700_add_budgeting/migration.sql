-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "BudgetCategory" AS ENUM ('SALES', 'COGS', 'OPERATING_EXPENSE', 'PAYROLL', 'MARKETING', 'ADMINISTRATION', 'CAPITAL_EXPENDITURE', 'OTHER');

-- CreateEnum
CREATE TYPE "BudgetControlPolicy" AS ENUM ('CHECK_ONLY', 'WARN', 'BLOCK');

-- CreateEnum
CREATE TYPE "BudgetControlResult" AS ENUM ('ALLOWED', 'WARNING', 'EXCEEDED');

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "budget_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "fiscal_year" INTEGER NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "currency_id" UUID NOT NULL,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "period_type" "BudgetPeriodType" NOT NULL DEFAULT 'MONTHLY',
    "version" INTEGER NOT NULL DEFAULT 1,
    "control_policy" "BudgetControlPolicy" NOT NULL DEFAULT 'WARN',
    "warn_threshold_percent" DECIMAL(5,2) NOT NULL DEFAULT 90.00,
    "total_budget" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budget_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "budget_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "category" "BudgetCategory" NOT NULL DEFAULT 'OTHER',
    "fiscal_period_id" UUID,
    "period" VARCHAR(50) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "budget_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_organization_id_budget_number_key" ON "budgets"("organization_id", "budget_number");

-- CreateIndex
CREATE INDEX "budgets_organization_id_status_idx" ON "budgets"("organization_id", "status");

-- CreateIndex
CREATE INDEX "budgets_organization_id_fiscal_year_idx" ON "budgets"("organization_id", "fiscal_year");

-- CreateIndex
CREATE INDEX "budgets_organization_id_start_date_end_date_idx" ON "budgets"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "budget_lines_organization_id_budget_id_account_id_period_key" ON "budget_lines"("organization_id", "budget_id", "account_id", "period");

-- CreateIndex
CREATE INDEX "budget_lines_organization_id_budget_id_idx" ON "budget_lines"("organization_id", "budget_id");

-- CreateIndex
CREATE INDEX "budget_lines_organization_id_account_id_idx" ON "budget_lines"("organization_id", "account_id");

-- CreateIndex
CREATE INDEX "budget_lines_organization_id_fiscal_period_id_idx" ON "budget_lines"("organization_id", "fiscal_period_id");

-- CreateIndex
CREATE INDEX "budget_lines_organization_id_category_idx" ON "budget_lines"("organization_id", "category");

-- CreateIndex
CREATE INDEX "budget_lines_organization_id_start_date_end_date_idx" ON "budget_lines"("organization_id", "start_date", "end_date");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_fkey" FOREIGN KEY ("budget_id") REFERENCES "budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
