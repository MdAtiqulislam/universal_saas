-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'VOIDED', 'NOT_APPLICABLE');
CREATE TYPE "WarrantyCoverageType" AS ENUM ('FULL', 'PARTS_ONLY', 'LABOR_ONLY', 'LIMITED', 'NONE');
CREATE TYPE "CustomerAssetServiceStatus" AS ENUM ('OPERATIONAL', 'UNDER_SERVICE', 'DECOMMISSIONED', 'SCRAPPED');
CREATE TYPE "ServiceRequestType" AS ENUM ('REPAIR', 'MAINTENANCE', 'INSTALLATION', 'WARRANTY_CLAIM', 'INSPECTION', 'CONFIGURATION', 'TRAINING', 'OTHER');
CREATE TYPE "ServiceRequestStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'TRIAGED', 'CONVERTED_TO_TICKET', 'CANCELLED', 'REJECTED');
CREATE TYPE "ServicePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');
CREATE TYPE "ServiceTicketStatus" AS ENUM ('OPEN', 'TRIAGED', 'ASSIGNED', 'IN_DIAGNOSIS', 'AWAITING_APPROVAL', 'APPROVED', 'IN_SERVICE', 'QUALITY_CHECK', 'COMPLETED', 'HANDED_OVER', 'CLOSED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE "ServiceSlaStatus" AS ENUM ('ON_TRACK', 'AT_RISK', 'BREACHED', 'MET');
CREATE TYPE "ServiceAssignmentStatus" AS ENUM ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNED', 'CANCELLED');
CREATE TYPE "ServiceEstimateStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ServiceLineType" AS ENUM ('PART', 'LABOR', 'SERVICE_FEE', 'TRAVEL', 'OTHER');
CREATE TYPE "ServiceOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'QUALITY_CHECK', 'COMPLETED', 'HANDED_OVER', 'CLOSED', 'ON_HOLD', 'CANCELLED');

-- CreateTable service_configurations
CREATE TABLE "service_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "default_service_location_id" UUID,
    "default_repair_location_id" UUID,
    "default_parts_location_id" UUID,
    "default_quality_inspection_required" BOOLEAN NOT NULL DEFAULT true,
    "default_warranty_duration_days" INTEGER NOT NULL DEFAULT 365,
    "default_service_sla_hours" INTEGER NOT NULL DEFAULT 48,
    "default_labor_rate" DECIMAL(20,4) NOT NULL DEFAULT 75.0000,
    "default_service_revenue_account_id" UUID,
    "default_warranty_expense_account_id" UUID,
    "default_service_parts_expense_account_id" UUID,
    "auto_create_quality_inspection" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable customer_assets
CREATE TABLE "customer_assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "asset_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "serial_id" UUID,
    "serial_number" VARCHAR(100),
    "original_sales_order_id" UUID,
    "delivery_order_id" UUID,
    "shipment_id" UUID,
    "customer_invoice_id" UUID,
    "installation_date" DATE,
    "purchase_date" DATE NOT NULL,
    "warranty_start_date" DATE NOT NULL,
    "warranty_end_date" DATE NOT NULL,
    "warranty_status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "service_status" "CustomerAssetServiceStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "location_address" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable warranty_policies
CREATE TABLE "warranty_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "duration_months" INTEGER NOT NULL DEFAULT 12,
    "coverage_type" "WarrantyCoverageType" NOT NULL DEFAULT 'FULL',
    "labor_covered" BOOLEAN NOT NULL DEFAULT true,
    "parts_covered" BOOLEAN NOT NULL DEFAULT true,
    "replacement_covered" BOOLEAN NOT NULL DEFAULT false,
    "inspection_required" BOOLEAN NOT NULL DEFAULT true,
    "exclusions" JSONB,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warranty_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable customer_asset_warranties
CREATE TABLE "customer_asset_warranties" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "customer_asset_id" UUID NOT NULL,
    "warranty_policy_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "claim_limit_amount" DECIMAL(20,4),
    "claimed_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_asset_warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_requests
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "request_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_asset_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "serial_number" VARCHAR(100),
    "request_type" "ServiceRequestType" NOT NULL DEFAULT 'REPAIR',
    "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',
    "issue_category" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "source_rma_id" UUID,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "preferred_service_date" DATE,
    "warranty_eligibility" JSONB,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "created_by_user_id" UUID NOT NULL,
    "triaged_by_user_id" UUID,
    "triaged_at" TIMESTAMPTZ(6),
    "triage_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_tickets
CREATE TABLE "service_tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "ticket_number" VARCHAR(50) NOT NULL,
    "service_request_id" UUID,
    "customer_id" UUID NOT NULL,
    "customer_asset_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "priority" "ServicePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "ServiceTicketStatus" NOT NULL DEFAULT 'OPEN',
    "sla_status" "ServiceSlaStatus" NOT NULL DEFAULT 'ON_TRACK',
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_response_due_at" TIMESTAMPTZ(6),
    "first_response_at" TIMESTAMPTZ(6),
    "resolution_due_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "breach_reason" TEXT,
    "assigned_technician_id" UUID,
    "assigned_at" TIMESTAMPTZ(6),
    "subject" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_assignments
CREATE TABLE "service_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_ticket_id" UUID,
    "service_order_id" UUID,
    "employee_id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL DEFAULT 'TECHNICIAN',
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_user_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "status" "ServiceAssignmentStatus" NOT NULL DEFAULT 'ACCEPTED',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_diagnoses
CREATE TABLE "service_diagnoses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_ticket_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "diagnosis_code" VARCHAR(50) NOT NULL,
    "symptoms" TEXT NOT NULL,
    "root_cause" TEXT NOT NULL,
    "repair_recommended" BOOLEAN NOT NULL DEFAULT true,
    "replacement_recommended" BOOLEAN NOT NULL DEFAULT false,
    "warranty_covered" BOOLEAN NOT NULL DEFAULT false,
    "diagnosed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_estimates
CREATE TABLE "service_estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "estimate_number" VARCHAR(50) NOT NULL,
    "service_ticket_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_asset_id" UUID,
    "status" "ServiceEstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "warranty_covered_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "customer_payable_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by" VARCHAR(100),
    "rejection_reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_estimate_lines
CREATE TABLE "service_estimate_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_estimate_id" UUID NOT NULL,
    "line_type" "ServiceLineType" NOT NULL DEFAULT 'PART',
    "item_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "unit_rate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "warranty_covered" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_estimate_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_orders
CREATE TABLE "service_orders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_order_number" VARCHAR(50) NOT NULL,
    "service_ticket_id" UUID,
    "customer_id" UUID NOT NULL,
    "customer_asset_id" UUID,
    "service_location_id" UUID,
    "assigned_technician_id" UUID,
    "warranty_status" "WarrantyStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "estimate_id" UUID,
    "scheduled_start_at" TIMESTAMPTZ(6),
    "scheduled_end_at" TIMESTAMPTZ(6),
    "actual_start_at" TIMESTAMPTZ(6),
    "actual_end_at" TIMESTAMPTZ(6),
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "labor_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "parts_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "other_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "customer_charge" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "warranty_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "customer_invoice_id" UUID,
    "source_rma_id" UUID,
    "inspection_lot_id" UUID,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_part_requirements
CREATE TABLE "service_part_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID,
    "location_id" UUID,
    "required_quantity" DECIMAL(20,4) NOT NULL DEFAULT 1,
    "reserved_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "issued_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "returned_quantity" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "unit_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "warranty_covered" BOOLEAN NOT NULL DEFAULT false,
    "stock_movement_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_part_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_labor_entries
CREATE TABLE "service_labor_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_order_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "billable_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "actual_hours" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "labor_rate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "internal_cost_rate" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "labor_cost" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "labor_charge" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "warranty_covered" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "is_finalized" BOOLEAN NOT NULL DEFAULT false,
    "finalized_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_labor_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable service_handovers
CREATE TABLE "service_handovers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "service_order_id" UUID NOT NULL,
    "handover_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipient_name" VARCHAR(100) NOT NULL,
    "recipient_contact" VARCHAR(100),
    "acceptance_notes" TEXT,
    "delivery_reference" VARCHAR(100),
    "handover_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_handovers_pkey" PRIMARY KEY ("id")
);

-- Unique and standard Indexes
CREATE UNIQUE INDEX "service_configurations_organization_id_key" ON "service_configurations"("organization_id");

CREATE UNIQUE INDEX "customer_assets_organization_id_asset_number_key" ON "customer_assets"("organization_id", "asset_number");
CREATE INDEX "customer_assets_organization_id_customer_id_idx" ON "customer_assets"("organization_id", "customer_id");
CREATE INDEX "customer_assets_organization_id_item_id_idx" ON "customer_assets"("organization_id", "item_id");
CREATE INDEX "customer_assets_organization_id_serial_number_idx" ON "customer_assets"("organization_id", "serial_number");
CREATE INDEX "customer_assets_organization_id_warranty_status_idx" ON "customer_assets"("organization_id", "warranty_status");
CREATE INDEX "customer_assets_organization_id_service_status_idx" ON "customer_assets"("organization_id", "service_status");

CREATE UNIQUE INDEX "warranty_policies_organization_id_code_key" ON "warranty_policies"("organization_id", "code");
CREATE INDEX "warranty_policies_organization_id_is_active_idx" ON "warranty_policies"("organization_id", "is_active");

CREATE INDEX "customer_asset_warranties_organization_id_customer_asset_id_idx" ON "customer_asset_warranties"("organization_id", "customer_asset_id");
CREATE INDEX "customer_asset_warranties_organization_id_warranty_policy_id_idx" ON "customer_asset_warranties"("organization_id", "warranty_policy_id");
CREATE INDEX "customer_asset_warranties_organization_id_status_idx" ON "customer_asset_warranties"("organization_id", "status");

CREATE UNIQUE INDEX "service_requests_organization_id_request_number_key" ON "service_requests"("organization_id", "request_number");
CREATE INDEX "service_requests_organization_id_customer_id_idx" ON "service_requests"("organization_id", "customer_id");
CREATE INDEX "service_requests_organization_id_customer_asset_id_idx" ON "service_requests"("organization_id", "customer_asset_id");
CREATE INDEX "service_requests_organization_id_status_idx" ON "service_requests"("organization_id", "status");
CREATE INDEX "service_requests_organization_id_priority_idx" ON "service_requests"("organization_id", "priority");
CREATE INDEX "service_requests_organization_id_source_rma_id_idx" ON "service_requests"("organization_id", "source_rma_id");

CREATE UNIQUE INDEX "service_tickets_organization_id_ticket_number_key" ON "service_tickets"("organization_id", "ticket_number");
CREATE INDEX "service_tickets_organization_id_customer_id_idx" ON "service_tickets"("organization_id", "customer_id");
CREATE INDEX "service_tickets_organization_id_customer_asset_id_idx" ON "service_tickets"("organization_id", "customer_asset_id");
CREATE INDEX "service_tickets_organization_id_status_idx" ON "service_tickets"("organization_id", "status");
CREATE INDEX "service_tickets_organization_id_sla_status_idx" ON "service_tickets"("organization_id", "sla_status");
CREATE INDEX "service_tickets_organization_id_assigned_technician_id_idx" ON "service_tickets"("organization_id", "assigned_technician_id");

CREATE INDEX "service_assignments_organization_id_service_ticket_id_idx" ON "service_assignments"("organization_id", "service_ticket_id");
CREATE INDEX "service_assignments_organization_id_service_order_id_idx" ON "service_assignments"("organization_id", "service_order_id");
CREATE INDEX "service_assignments_organization_id_employee_id_idx" ON "service_assignments"("organization_id", "employee_id");
CREATE INDEX "service_assignments_organization_id_status_idx" ON "service_assignments"("organization_id", "status");

CREATE INDEX "service_diagnoses_organization_id_service_ticket_id_idx" ON "service_diagnoses"("organization_id", "service_ticket_id");
CREATE INDEX "service_diagnoses_organization_id_technician_id_idx" ON "service_diagnoses"("organization_id", "technician_id");

CREATE UNIQUE INDEX "service_estimates_organization_id_estimate_number_key" ON "service_estimates"("organization_id", "estimate_number");
CREATE INDEX "service_estimates_organization_id_service_ticket_id_idx" ON "service_estimates"("organization_id", "service_ticket_id");
CREATE INDEX "service_estimates_organization_id_customer_id_idx" ON "service_estimates"("organization_id", "customer_id");
CREATE INDEX "service_estimates_organization_id_status_idx" ON "service_estimates"("organization_id", "status");

CREATE INDEX "service_estimate_lines_organization_id_service_estimate_id_idx" ON "service_estimate_lines"("organization_id", "service_estimate_id");

CREATE UNIQUE INDEX "service_orders_organization_id_service_order_number_key" ON "service_orders"("organization_id", "service_order_number");
CREATE INDEX "service_orders_organization_id_customer_id_idx" ON "service_orders"("organization_id", "customer_id");
CREATE INDEX "service_orders_organization_id_customer_asset_id_idx" ON "service_orders"("organization_id", "customer_asset_id");
CREATE INDEX "service_orders_organization_id_status_idx" ON "service_orders"("organization_id", "status");
CREATE INDEX "service_orders_organization_id_assigned_technician_id_idx" ON "service_orders"("organization_id", "assigned_technician_id");
CREATE INDEX "service_orders_organization_id_source_rma_id_idx" ON "service_orders"("organization_id", "source_rma_id");
CREATE INDEX "service_orders_organization_id_customer_invoice_id_idx" ON "service_orders"("organization_id", "customer_invoice_id");

CREATE INDEX "service_part_requirements_organization_id_service_order_id_idx" ON "service_part_requirements"("organization_id", "service_order_id");
CREATE INDEX "service_part_requirements_organization_id_item_id_idx" ON "service_part_requirements"("organization_id", "item_id");

CREATE INDEX "service_labor_entries_organization_id_service_order_id_idx" ON "service_labor_entries"("organization_id", "service_order_id");
CREATE INDEX "service_labor_entries_organization_id_employee_id_idx" ON "service_labor_entries"("organization_id", "employee_id");

CREATE INDEX "service_handovers_organization_id_service_order_id_idx" ON "service_handovers"("organization_id", "service_order_id");

-- Foreign Keys
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_service_location_id_fkey" FOREIGN KEY ("default_service_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_repair_location_id_fkey" FOREIGN KEY ("default_repair_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_parts_location_id_fkey" FOREIGN KEY ("default_parts_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_service_revenue_account_id_fkey" FOREIGN KEY ("default_service_revenue_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_warranty_expense_account_id_fkey" FOREIGN KEY ("default_warranty_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_configurations" ADD CONSTRAINT "service_configurations_default_service_parts_expense_account_id_fkey" FOREIGN KEY ("default_service_parts_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_original_sales_order_id_fkey" FOREIGN KEY ("original_sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_assets" ADD CONSTRAINT "customer_assets_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warranty_policies" ADD CONSTRAINT "warranty_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_asset_warranties" ADD CONSTRAINT "customer_asset_warranties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_asset_warranties" ADD CONSTRAINT "customer_asset_warranties_customer_asset_id_fkey" FOREIGN KEY ("customer_asset_id") REFERENCES "customer_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_asset_warranties" ADD CONSTRAINT "customer_asset_warranties_warranty_policy_id_fkey" FOREIGN KEY ("warranty_policy_id") REFERENCES "warranty_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_asset_id_fkey" FOREIGN KEY ("customer_asset_id") REFERENCES "customer_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_source_rma_id_fkey" FOREIGN KEY ("source_rma_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_service_request_id_fkey" FOREIGN KEY ("service_request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_customer_asset_id_fkey" FOREIGN KEY ("customer_asset_id") REFERENCES "customer_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_tickets" ADD CONSTRAINT "service_tickets_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_diagnoses" ADD CONSTRAINT "service_diagnoses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_diagnoses" ADD CONSTRAINT "service_diagnoses_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_diagnoses" ADD CONSTRAINT "service_diagnoses_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_estimates" ADD CONSTRAINT "service_estimates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_estimates" ADD CONSTRAINT "service_estimates_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_estimates" ADD CONSTRAINT "service_estimates_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_estimates" ADD CONSTRAINT "service_estimates_customer_asset_id_fkey" FOREIGN KEY ("customer_asset_id") REFERENCES "customer_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_estimate_lines" ADD CONSTRAINT "service_estimate_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_estimate_lines" ADD CONSTRAINT "service_estimate_lines_service_estimate_id_fkey" FOREIGN KEY ("service_estimate_id") REFERENCES "service_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_estimate_lines" ADD CONSTRAINT "service_estimate_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_service_ticket_id_fkey" FOREIGN KEY ("service_ticket_id") REFERENCES "service_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customer_asset_id_fkey" FOREIGN KEY ("customer_asset_id") REFERENCES "customer_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_service_location_id_fkey" FOREIGN KEY ("service_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_assigned_technician_id_fkey" FOREIGN KEY ("assigned_technician_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "service_estimates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_source_rma_id_fkey" FOREIGN KEY ("source_rma_id") REFERENCES "return_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_orders" ADD CONSTRAINT "service_orders_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "service_part_requirements" ADD CONSTRAINT "service_part_requirements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "service_labor_entries" ADD CONSTRAINT "service_labor_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_labor_entries" ADD CONSTRAINT "service_labor_entries_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_labor_entries" ADD CONSTRAINT "service_labor_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_handovers" ADD CONSTRAINT "service_handovers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_handovers" ADD CONSTRAINT "service_handovers_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
