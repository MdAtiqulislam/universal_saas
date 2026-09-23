-- Milestone M31: Quality Management, Inspection & Quality Control Foundation Migration
-- Create Enums
CREATE TYPE "InspectionType" AS ENUM (
    'INCOMING_PURCHASE',
    'IN_PROCESS_MANUFACTURING',
    'FINISHED_GOODS',
    'OUTGOING_SHIPMENT',
    'CUSTOMER_RETURN',
    'INTERNAL_TRANSFER',
    'ROUTINE_AUDIT'
);

CREATE TYPE "InspectionLotStatus" AS ENUM (
    'DRAFT',
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'DECIDED',
    'CANCELLED'
);

CREATE TYPE "InspectionDecision" AS ENUM (
    'ACCEPT',
    'ACCEPT_WITH_DEVIATION',
    'REWORK',
    'REJECT',
    'SCRAP',
    'RETURN_TO_SUPPLIER',
    'HOLD'
);

CREATE TYPE "SamplingType" AS ENUM (
    'FULL_100_PERCENT',
    'FIXED_QUANTITY',
    'PERCENTAGE_BASED',
    'LOT_SIZE_BASED'
);

CREATE TYPE "CharacteristicDataType" AS ENUM (
    'NUMERIC_SPEC',
    'QUALITATIVE_PASS_FAIL',
    'TEXT_OBSERVATION'
);

CREATE TYPE "QualityHoldStatus" AS ENUM (
    'ACTIVE',
    'RELEASED',
    'DISPOSITIONED',
    'CANCELLED'
);

CREATE TYPE "NonConformanceSeverity" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
);

CREATE TYPE "NonConformanceStatus" AS ENUM (
    'OPEN',
    'CONTAINED',
    'INVESTIGATING',
    'ROOT_CAUSE_IDENTIFIED',
    'DISPOSITIONED',
    'CAPA_REQUIRED',
    'CLOSED',
    'CANCELLED'
);

CREATE TYPE "CapaStatus" AS ENUM (
    'DRAFT',
    'OPEN',
    'IN_PROGRESS',
    'PENDING_VERIFICATION',
    'VERIFIED',
    'CLOSED',
    'CANCELLED'
);

CREATE TYPE "QualityIssueStatus" AS ENUM (
    'REPORTED',
    'UNDER_REVIEW',
    'INVESTIGATING',
    'NCR_CREATED',
    'RESOLVED',
    'CLOSED'
);

-- Create Table: sampling_plans
CREATE TABLE "sampling_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "sampling_type" "SamplingType" NOT NULL DEFAULT 'FULL_100_PERCENT',
    "fixed_sample_quantity" DECIMAL(18, 4),
    "percentage_rate" DECIMAL(5, 2),
    "lot_ranges_json" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sampling_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sampling_plans_organization_id_code_key" UNIQUE ("organization_id", "code"),
    CONSTRAINT "sampling_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sampling_plans_organization_id_is_active_idx" ON "sampling_plans"("organization_id", "is_active");

-- Create Table: quality_configurations
CREATE TABLE "quality_configurations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "default_inspection_type" "InspectionType" NOT NULL DEFAULT 'INCOMING_PURCHASE',
    "auto_create_incoming_lots" BOOLEAN NOT NULL DEFAULT false,
    "auto_create_finished_goods_lots" BOOLEAN NOT NULL DEFAULT false,
    "auto_create_outgoing_lots" BOOLEAN NOT NULL DEFAULT false,
    "hold_on_failure" BOOLEAN NOT NULL DEFAULT true,
    "require_all_mandatory_characteristics" BOOLEAN NOT NULL DEFAULT true,
    "default_sampling_plan_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quality_configurations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quality_configurations_organization_id_key" UNIQUE ("organization_id"),
    CONSTRAINT "quality_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quality_configurations_default_sampling_plan_id_fkey" FOREIGN KEY ("default_sampling_plan_id") REFERENCES "sampling_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create Table: inspection_plans
CREATE TABLE "inspection_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "plan_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "inspection_type" "InspectionType" NOT NULL DEFAULT 'INCOMING_PURCHASE',
    "sampling_plan_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "effective_from" DATE,
    "effective_to" DATE,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inspection_plans_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inspection_plans_organization_id_plan_number_key" UNIQUE ("organization_id", "plan_number"),
    CONSTRAINT "inspection_plans_organization_item_variant_type_ver_key" UNIQUE ("organization_id", "item_id", "variant_id", "inspection_type", "version"),
    CONSTRAINT "inspection_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inspection_plans_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspection_plans_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "inspection_plans_sampling_plan_id_fkey" FOREIGN KEY ("sampling_plan_id") REFERENCES "sampling_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "inspection_plans_organization_id_is_active_idx" ON "inspection_plans"("organization_id", "is_active");
CREATE INDEX "inspection_plans_organization_id_item_id_idx" ON "inspection_plans"("organization_id", "item_id");

-- Create Table: inspection_characteristics
CREATE TABLE "inspection_characteristics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "inspection_plan_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "data_type" "CharacteristicDataType" NOT NULL DEFAULT 'NUMERIC_SPEC',
    "unit_of_measure" VARCHAR(50),
    "target_value" DECIMAL(18, 4),
    "min_spec" DECIMAL(18, 4),
    "max_spec" DECIMAL(18, 4),
    "tolerance" DECIMAL(18, 4),
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "acceptance_criteria" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inspection_characteristics_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inspection_characteristics_org_plan_code_key" UNIQUE ("organization_id", "inspection_plan_id", "code"),
    CONSTRAINT "inspection_characteristics_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inspection_characteristics_inspection_plan_id_fkey" FOREIGN KEY ("inspection_plan_id") REFERENCES "inspection_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "inspection_characteristics_org_plan_seq_idx" ON "inspection_characteristics"("organization_id", "inspection_plan_id", "sequence");

-- Create Table: quality_inspection_lots
CREATE TABLE "quality_inspection_lots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "lot_number" VARCHAR(50) NOT NULL,
    "inspection_plan_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "batch_id" UUID,
    "serial_id" UUID,
    "inspection_type" "InspectionType" NOT NULL DEFAULT 'INCOMING_PURCHASE',
    "total_quantity" DECIMAL(18, 4) NOT NULL,
    "sample_quantity" DECIMAL(18, 4) NOT NULL,
    "inspected_quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
    "passed_quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
    "failed_quantity" DECIMAL(18, 4) NOT NULL DEFAULT 0,
    "status" "InspectionLotStatus" NOT NULL DEFAULT 'DRAFT',
    "decision" "InspectionDecision",
    "decision_notes" TEXT,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "goods_receipt_id" UUID,
    "purchase_order_id" UUID,
    "production_order_id" UUID,
    "delivery_order_id" UUID,
    "shipment_id" UUID,
    "supplier_id" UUID,
    "customer_id" UUID,
    "notes" TEXT,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quality_inspection_lots_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quality_inspection_lots_org_lot_number_key" UNIQUE ("organization_id", "lot_number"),
    CONSTRAINT "quality_inspection_lots_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_inspection_plan_id_fkey" FOREIGN KEY ("inspection_plan_id") REFERENCES "inspection_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_inspection_lots_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "quality_inspection_lots_org_status_idx" ON "quality_inspection_lots"("organization_id", "status");
CREATE INDEX "quality_inspection_lots_org_type_idx" ON "quality_inspection_lots"("organization_id", "inspection_type");
CREATE INDEX "quality_inspection_lots_org_item_idx" ON "quality_inspection_lots"("organization_id", "item_id");
CREATE INDEX "quality_inspection_lots_org_supplier_idx" ON "quality_inspection_lots"("organization_id", "supplier_id");
CREATE INDEX "quality_inspection_lots_org_gr_idx" ON "quality_inspection_lots"("organization_id", "goods_receipt_id");
CREATE INDEX "quality_inspection_lots_org_po_prod_idx" ON "quality_inspection_lots"("organization_id", "production_order_id");

-- Create Table: inspection_results
CREATE TABLE "inspection_results" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "inspection_lot_id" UUID NOT NULL,
    "characteristic_id" UUID NOT NULL,
    "sample_number" INTEGER NOT NULL,
    "observed_numeric_value" DECIMAL(18, 4),
    "observed_text_value" TEXT,
    "is_pass" BOOLEAN NOT NULL,
    "inspector_user_id" UUID NOT NULL,
    "inspected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inspection_results_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inspection_results_org_lot_char_sample_key" UNIQUE ("organization_id", "inspection_lot_id", "characteristic_id", "sample_number"),
    CONSTRAINT "inspection_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inspection_results_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "inspection_results_characteristic_id_fkey" FOREIGN KEY ("characteristic_id") REFERENCES "inspection_characteristics"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "inspection_results_org_lot_idx" ON "inspection_results"("organization_id", "inspection_lot_id");

-- Create Table: quality_holds
CREATE TABLE "quality_holds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "hold_number" VARCHAR(50) NOT NULL,
    "inspection_lot_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "batch_id" UUID,
    "serial_id" UUID,
    "hold_quantity" DECIMAL(18, 4) NOT NULL,
    "status" "QualityHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "released_by_user_id" UUID,
    "released_at" TIMESTAMPTZ(6),
    "release_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quality_holds_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "quality_holds_org_hold_number_key" UNIQUE ("organization_id", "hold_number"),
    CONSTRAINT "quality_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "quality_holds_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "quality_holds_org_status_idx" ON "quality_holds"("organization_id", "status");
CREATE INDEX "quality_holds_org_item_idx" ON "quality_holds"("organization_id", "item_id");

-- Create Table: non_conformances
CREATE TABLE "non_conformances" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "ncr_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "source_inspection_lot_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "batch_id" UUID,
    "serial_id" UUID,
    "supplier_id" UUID,
    "customer_id" UUID,
    "production_order_id" UUID,
    "quantity_affected" DECIMAL(18, 4) NOT NULL,
    "severity" "NonConformanceSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "NonConformanceStatus" NOT NULL DEFAULT 'OPEN',
    "root_cause" TEXT,
    "containment_action" TEXT,
    "disposition" VARCHAR(50),
    "disposition_notes" TEXT,
    "owner_user_id" UUID,
    "target_date" DATE,
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "non_conformances_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "non_conformances_org_ncr_number_key" UNIQUE ("organization_id", "ncr_number"),
    CONSTRAINT "non_conformances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_source_inspection_lot_id_fkey" FOREIGN KEY ("source_inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "non_conformances_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "non_conformances_org_status_idx" ON "non_conformances"("organization_id", "status");
CREATE INDEX "non_conformances_org_severity_idx" ON "non_conformances"("organization_id", "severity");
CREATE INDEX "non_conformances_org_item_idx" ON "non_conformances"("organization_id", "item_id");
CREATE INDEX "non_conformances_org_supplier_idx" ON "non_conformances"("organization_id", "supplier_id");

-- Create Table: capas
CREATE TABLE "capas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "capa_number" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "non_conformance_id" UUID,
    "source_inspection_lot_id" UUID,
    "root_cause_analysis" TEXT,
    "corrective_action" TEXT,
    "preventive_action" TEXT,
    "owner_user_id" UUID,
    "target_date" DATE,
    "verified_by_user_id" UUID,
    "verified_at" TIMESTAMPTZ(6),
    "verification_notes" TEXT,
    "effectiveness_review" TEXT,
    "status" "CapaStatus" NOT NULL DEFAULT 'DRAFT',
    "closed_at" TIMESTAMPTZ(6),
    "closed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "capas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "capas_org_capa_number_key" UNIQUE ("organization_id", "capa_number"),
    CONSTRAINT "capas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "capas_non_conformance_id_fkey" FOREIGN KEY ("non_conformance_id") REFERENCES "non_conformances"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "capas_source_inspection_lot_id_fkey" FOREIGN KEY ("source_inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "capas_org_status_idx" ON "capas"("organization_id", "status");
CREATE INDEX "capas_org_ncr_idx" ON "capas"("organization_id", "non_conformance_id");

-- Create Table: customer_quality_issues
CREATE TABLE "customer_quality_issues" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "issue_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "sales_order_id" UUID,
    "shipment_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "batch_id" UUID,
    "serial_id" UUID,
    "issue_description" TEXT NOT NULL,
    "reported_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" "NonConformanceSeverity" NOT NULL DEFAULT 'MEDIUM',
    "status" "QualityIssueStatus" NOT NULL DEFAULT 'REPORTED',
    "non_conformance_id" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_quality_issues_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_quality_issues_org_issue_number_key" UNIQUE ("organization_id", "issue_number"),
    CONSTRAINT "customer_quality_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customer_quality_issues_non_conformance_id_fkey" FOREIGN KEY ("non_conformance_id") REFERENCES "non_conformances"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "customer_quality_issues_org_status_idx" ON "customer_quality_issues"("organization_id", "status");
CREATE INDEX "customer_quality_issues_org_customer_idx" ON "customer_quality_issues"("organization_id", "customer_id");
CREATE INDEX "customer_quality_issues_org_item_idx" ON "customer_quality_issues"("organization_id", "item_id");
