-- AlterEnum
ALTER TYPE "FiscalPeriodStatus" ADD VALUE IF NOT EXISTS 'CLOSING';

-- CreateEnum
CREATE TYPE "PeriodCloseCheckType" AS ENUM (
    'TRIAL_BALANCE',
    'UNBALANCED_JOURNALS',
    'UNPOSTED_TRANSACTIONS',
    'AP_RECONCILIATION',
    'AR_RECONCILIATION',
    'INVENTORY_RECONCILIATION',
    'TAX_RECONCILIATION',
    'PAYROLL_RECONCILIATION',
    'FIXED_ASSET_RECONCILIATION',
    'COGS_RECONCILIATION',
    'SUBLEDGER_RECONCILIATION'
);

-- CreateEnum
CREATE TYPE "PeriodCloseCheckStatus" AS ENUM (
    'PASSED',
    'WARNING',
    'FAILED',
    'NOT_APPLICABLE'
);

-- CreateEnum
CREATE TYPE "PeriodCloseRunStatus" AS ENUM (
    'PENDING',
    'RUNNING',
    'PASSED',
    'FAILED',
    'CLOSED',
    'CANCELLED'
);

-- CreateEnum
CREATE TYPE "ReportSnapshotType" AS ENUM (
    'TRIAL_BALANCE',
    'PROFIT_LOSS',
    'BALANCE_SHEET',
    'CASH_FLOW',
    'SUBLEDGER_RECONCILIATION'
);

-- AlterTable
ALTER TABLE "fiscal_periods"
ADD COLUMN "fiscal_year" INTEGER,
ADD COLUMN "period_number" INTEGER,
ADD COLUMN "closed_by_user_id" UUID,
ADD COLUMN "reopened_at" TIMESTAMPTZ(6),
ADD COLUMN "reopened_by_user_id" UUID,
ADD COLUMN "reopen_reason" TEXT,
ADD COLUMN "close_run_id" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_periods_organization_id_fiscal_year_period_number_key" ON "fiscal_periods"("organization_id", "fiscal_year", "period_number");

-- CreateTable
CREATE TABLE "period_close_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "initiated_by_user_id" UUID NOT NULL,
    "status" "PeriodCloseRunStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),
    "validation_summary" TEXT,
    "failure_information" JSONB,
    "idempotency_key" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_close_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "period_close_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "close_run_id" UUID NOT NULL,
    "check_type" "PeriodCloseCheckType" NOT NULL,
    "status" "PeriodCloseCheckStatus" NOT NULL DEFAULT 'PASSED',
    "severity" VARCHAR(20) NOT NULL DEFAULT 'BLOCKING',
    "message" TEXT NOT NULL,
    "affected_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "evaluated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "period_close_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_report_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "fiscal_period_id" UUID,
    "report_type" "ReportSnapshotType" NOT NULL,
    "generated_by_user_id" UUID NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "report_parameters" JSONB,
    "report_data" JSONB NOT NULL,
    "checksum" VARCHAR(64),
    "is_immutable" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "period_close_runs_organization_id_fiscal_period_id_idx" ON "period_close_runs"("organization_id", "fiscal_period_id");
CREATE INDEX "period_close_runs_organization_id_status_idx" ON "period_close_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "period_close_checks_organization_id_close_run_id_idx" ON "period_close_checks"("organization_id", "close_run_id");
CREATE INDEX "period_close_checks_organization_id_check_type_idx" ON "period_close_checks"("organization_id", "check_type");

-- CreateIndex
CREATE INDEX "financial_report_snapshots_organization_id_report_type_idx" ON "financial_report_snapshots"("organization_id", "report_type");
CREATE INDEX "financial_report_snapshots_organization_id_fiscal_period_id_idx" ON "financial_report_snapshots"("organization_id", "fiscal_period_id");

-- AddForeignKey
ALTER TABLE "period_close_runs" ADD CONSTRAINT "period_close_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "period_close_runs" ADD CONSTRAINT "period_close_runs_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "period_close_checks" ADD CONSTRAINT "period_close_checks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "period_close_checks" ADD CONSTRAINT "period_close_checks_close_run_id_fkey" FOREIGN KEY ("close_run_id") REFERENCES "period_close_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_report_snapshots" ADD CONSTRAINT "financial_report_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "financial_report_snapshots" ADD CONSTRAINT "financial_report_snapshots_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
