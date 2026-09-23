-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "EmploymentType" AS ENUM ('FULL_TIME', 'PART_TIME', 'CONTRACT', 'TEMPORARY', 'INTERN');

-- CreateEnum
CREATE TYPE "PayrollFrequency" AS ENUM ('MONTHLY', 'BI_MONTHLY', 'WEEKLY');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'OPEN', 'CALCULATING', 'CALCULATED', 'APPROVED', 'POSTED', 'PAID', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'APPROVED', 'POSTED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PayrollComponentType" AS ENUM ('BASE_SALARY', 'HOUSING_ALLOWANCE', 'TRANSPORT_ALLOWANCE', 'MEDICAL_ALLOWANCE', 'OVERTIME', 'BONUS', 'EMPLOYEE_TAX', 'PENSION', 'OTHER_DEDUCTION', 'EMPLOYER_CONTRIBUTION');

-- CreateEnum
CREATE TYPE "PayrollCalculationType" AS ENUM ('FIXED', 'PERCENTAGE', 'FORMULA');

-- CreateEnum
CREATE TYPE "PayrollInputType" AS ENUM ('OVERTIME', 'BONUS', 'COMMISSION', 'UNPAID_LEAVE', 'OTHER_EARNING', 'OTHER_DEDUCTION');

-- CreateEnum
CREATE TYPE "PayrollPaymentStatus" AS ENUM ('PENDING', 'PAID');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "parent_department_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_positions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "department_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "job_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_number" VARCHAR(50) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "national_id_reference" VARCHAR(100),
    "hire_date" DATE NOT NULL,
    "termination_date" DATE,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "employment_type" "EmploymentType" NOT NULL DEFAULT 'FULL_TIME',
    "department_id" UUID,
    "job_position_id" UUID,
    "designation" VARCHAR(200),
    "manager_employee_id" UUID,
    "default_payment_account_id" UUID,
    "payroll_currency_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_compensations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "base_salary" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "housing_allowance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "transport_allowance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "medical_allowance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "other_allowance" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "overtime_rate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "payment_account_id" UUID,
    "currency_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "employee_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_frequency" "PayrollFrequency" NOT NULL DEFAULT 'MONTHLY',
    "default_currency_id" UUID NOT NULL,
    "working_days_per_period" INTEGER NOT NULL DEFAULT 22,
    "standard_working_hours" DECIMAL(5,2) NOT NULL DEFAULT 8.00,
    "overtime_enabled" BOOLEAN NOT NULL DEFAULT true,
    "tax_enabled" BOOLEAN NOT NULL DEFAULT true,
    "budget_control_policy" "BudgetControlPolicy" NOT NULL DEFAULT 'WARN',
    "payroll_expense_account_id" UUID,
    "payroll_payable_account_id" UUID,
    "payroll_tax_payable_account_id" UUID,
    "overtime_expense_account_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_components" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "component_type" "PayrollComponentType" NOT NULL,
    "calculation_type" "PayrollCalculationType" NOT NULL DEFAULT 'FIXED',
    "taxable" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expense_account_id" UUID,
    "liability_account_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "period_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "payment_date" DATE NOT NULL,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "processed_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "posted_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "run_number" VARCHAR(50) NOT NULL,
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "gross_pay" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_deductions" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "employer_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "journal_entry_id" UUID,
    "payment_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_run_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "base_salary" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "allowances" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "gross_pay" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "taxable_income" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "employee_tax" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "employee_deductions" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "employer_contributions" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "net_pay" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_employer_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "payment_status" "PayrollPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "payment_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_inputs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "payroll_period_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "input_type" "PayrollInputType" NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "description" TEXT,
    "source_reference" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_inputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_organization_id_code_key" ON "departments"("organization_id", "code");
CREATE INDEX "departments_organization_id_parent_department_id_idx" ON "departments"("organization_id", "parent_department_id");
CREATE INDEX "departments_organization_id_active_idx" ON "departments"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "job_positions_organization_id_code_key" ON "job_positions"("organization_id", "code");
CREATE INDEX "job_positions_organization_id_department_id_idx" ON "job_positions"("organization_id", "department_id");
CREATE INDEX "job_positions_organization_id_active_idx" ON "job_positions"("organization_id", "active");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_number_key" ON "employees"("organization_id", "employee_number");
CREATE INDEX "employees_organization_id_employment_status_idx" ON "employees"("organization_id", "employment_status");
CREATE INDEX "employees_organization_id_department_id_idx" ON "employees"("organization_id", "department_id");
CREATE INDEX "employees_organization_id_manager_employee_id_idx" ON "employees"("organization_id", "manager_employee_id");
CREATE INDEX "employees_organization_id_hire_date_idx" ON "employees"("organization_id", "hire_date");

-- CreateIndex
CREATE INDEX "employee_compensations_organization_id_employee_id_idx" ON "employee_compensations"("organization_id", "employee_id");
CREATE INDEX "employee_compensations_organization_id_effective_from_effective_until_idx" ON "employee_compensations"("organization_id", "effective_from", "effective_until");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_configurations_organization_id_key" ON "payroll_configurations"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_components_organization_id_code_key" ON "payroll_components"("organization_id", "code");
CREATE INDEX "payroll_components_organization_id_component_type_idx" ON "payroll_components"("organization_id", "component_type");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_periods_organization_id_period_number_key" ON "payroll_periods"("organization_id", "period_number");
CREATE INDEX "payroll_periods_organization_id_status_idx" ON "payroll_periods"("organization_id", "status");
CREATE INDEX "payroll_periods_organization_id_start_date_end_date_idx" ON "payroll_periods"("organization_id", "start_date", "end_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organization_id_run_number_key" ON "payroll_runs"("organization_id", "run_number");
CREATE INDEX "payroll_runs_organization_id_payroll_period_id_idx" ON "payroll_runs"("organization_id", "payroll_period_id");
CREATE INDEX "payroll_runs_organization_id_status_idx" ON "payroll_runs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_employees_payroll_run_id_employee_id_key" ON "payroll_employees"("payroll_run_id", "employee_id");
CREATE INDEX "payroll_employees_organization_id_payroll_run_id_idx" ON "payroll_employees"("organization_id", "payroll_run_id");
CREATE INDEX "payroll_employees_organization_id_employee_id_idx" ON "payroll_employees"("organization_id", "employee_id");

-- CreateIndex
CREATE INDEX "payroll_inputs_organization_id_payroll_period_id_idx" ON "payroll_inputs"("organization_id", "payroll_period_id");
CREATE INDEX "payroll_inputs_organization_id_employee_id_idx" ON "payroll_inputs"("organization_id", "employee_id");

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_department_id_fkey" FOREIGN KEY ("parent_department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_positions" ADD CONSTRAINT "job_positions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_job_position_id_fkey" FOREIGN KEY ("job_position_id") REFERENCES "job_positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_default_payment_account_id_fkey" FOREIGN KEY ("default_payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_payroll_currency_id_fkey" FOREIGN KEY ("payroll_currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employee_compensations" ADD CONSTRAINT "employee_compensations_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_default_currency_id_fkey" FOREIGN KEY ("default_currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_payroll_expense_account_id_fkey" FOREIGN KEY ("payroll_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_payroll_payable_account_id_fkey" FOREIGN KEY ("payroll_payable_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_payroll_tax_payable_account_id_fkey" FOREIGN KEY ("payroll_tax_payable_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_configurations" ADD CONSTRAINT "payroll_configurations_overtime_expense_account_id_fkey" FOREIGN KEY ("overtime_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_components" ADD CONSTRAINT "payroll_components_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_components" ADD CONSTRAINT "payroll_components_expense_account_id_fkey" FOREIGN KEY ("expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_components" ADD CONSTRAINT "payroll_components_liability_account_id_fkey" FOREIGN KEY ("liability_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payroll_employees" ADD CONSTRAINT "payroll_employees_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_payroll_period_id_fkey" FOREIGN KEY ("payroll_period_id") REFERENCES "payroll_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payroll_inputs" ADD CONSTRAINT "payroll_inputs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
