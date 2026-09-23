-- CreateEnum
CREATE TYPE "BomStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'OBSOLETE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'PARTIALLY_COMPLETED', 'COMPLETED', 'CLOSED', 'CANCELLED', 'VOIDED');

-- CreateEnum
CREATE TYPE "ProductionLineStatus" AS ENUM ('PENDING', 'PARTIALLY_ISSUED', 'FULLY_ISSUED', 'OVER_ISSUED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ProductionScrapType" AS ENUM ('NORMAL', 'ABNORMAL', 'REJECTED', 'DEFECTIVE');

-- CreateTable
CREATE TABLE "bill_of_materials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bom_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "uom_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BomStatus" NOT NULL DEFAULT 'DRAFT',
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bill_of_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bill_of_material_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "bom_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID NOT NULL,
    "scrap_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    "line_number" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bill_of_material_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manufacturing_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "wip_account_id" UUID,
    "raw_material_account_id" UUID,
    "finished_goods_account_id" UUID,
    "labor_account_id" UUID,
    "overhead_account_id" UUID,
    "variance_account_id" UUID,
    "allow_release_on_shortage" BOOLEAN NOT NULL DEFAULT false,
    "default_location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "manufacturing_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "bom_id" UUID NOT NULL,
    "planned_quantity" DECIMAL(18,4) NOT NULL,
    "produced_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "scrap_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "location_id" UUID NOT NULL,
    "status" "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "planned_start_date" DATE NOT NULL,
    "planned_completion_date" DATE NOT NULL,
    "actual_start_date" TIMESTAMPTZ(6),
    "actual_completion_date" TIMESTAMPTZ(6),
    "material_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "labor_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "overhead_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "total_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "unit_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "source_document" VARCHAR(100),
    "source_document_id" UUID,
    "issue_journal_entry_id" UUID,
    "completion_journal_entry_id" UUID,
    "variance_journal_entry_id" UUID,
    "notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "released_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "closed_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_order_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "required_quantity" DECIMAL(18,4) NOT NULL,
    "issued_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "returned_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "consumed_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "scrap_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "unit_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "total_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "uom_id" UUID NOT NULL,
    "status" "ProductionLineStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "production_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_material_issues" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "production_order_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "total_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "batch_id" UUID,
    "serial_id" UUID,
    "stock_movement_id" UUID,
    "issue_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_material_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_outputs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "production_order_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "scrap_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "unit_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "total_cost" DECIMAL(20,4) NOT NULL DEFAULT 0.0000,
    "batch_id" UUID,
    "serial_id" UUID,
    "stock_movement_id" UUID,
    "output_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "production_outputs_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "bill_of_materials_organization_id_bom_number_key" ON "bill_of_materials"("organization_id", "bom_number");
CREATE INDEX "bill_of_materials_organization_id_item_id_idx" ON "bill_of_materials"("organization_id", "item_id");
CREATE INDEX "bill_of_materials_organization_id_status_idx" ON "bill_of_materials"("organization_id", "status");

CREATE INDEX "bill_of_material_lines_organization_id_bom_id_idx" ON "bill_of_material_lines"("organization_id", "bom_id");
CREATE INDEX "bill_of_material_lines_organization_id_item_id_idx" ON "bill_of_material_lines"("organization_id", "item_id");

CREATE UNIQUE INDEX "manufacturing_configurations_organization_id_key" ON "manufacturing_configurations"("organization_id");

CREATE UNIQUE INDEX "production_orders_organization_id_order_number_key" ON "production_orders"("organization_id", "order_number");
CREATE INDEX "production_orders_organization_id_status_idx" ON "production_orders"("organization_id", "status");
CREATE INDEX "production_orders_organization_id_item_id_idx" ON "production_orders"("organization_id", "item_id");
CREATE INDEX "production_orders_organization_id_bom_id_idx" ON "production_orders"("organization_id", "bom_id");
CREATE INDEX "production_orders_organization_id_location_id_idx" ON "production_orders"("organization_id", "location_id");

CREATE INDEX "production_order_lines_organization_id_production_order_id_idx" ON "production_order_lines"("organization_id", "production_order_id");
CREATE INDEX "production_order_lines_organization_id_item_id_idx" ON "production_order_lines"("organization_id", "item_id");

CREATE INDEX "production_material_issues_organization_id_production_order_id_idx" ON "production_material_issues"("organization_id", "production_order_id");
CREATE INDEX "production_material_issues_organization_id_item_id_idx" ON "production_material_issues"("organization_id", "item_id");

CREATE INDEX "production_outputs_organization_id_production_order_id_idx" ON "production_outputs"("organization_id", "production_order_id");
CREATE INDEX "production_outputs_organization_id_item_id_idx" ON "production_outputs"("organization_id", "item_id");

-- Foreign Keys
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bill_of_materials" ADD CONSTRAINT "bill_of_materials_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "bill_of_material_lines" ADD CONSTRAINT "bill_of_material_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bill_of_material_lines" ADD CONSTRAINT "bill_of_material_lines_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bill_of_material_lines" ADD CONSTRAINT "bill_of_material_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bill_of_material_lines" ADD CONSTRAINT "bill_of_material_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bill_of_material_lines" ADD CONSTRAINT "bill_of_material_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_wip_account_id_fkey" FOREIGN KEY ("wip_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_raw_material_account_id_fkey" FOREIGN KEY ("raw_material_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_finished_goods_account_id_fkey" FOREIGN KEY ("finished_goods_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_labor_account_id_fkey" FOREIGN KEY ("labor_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_overhead_account_id_fkey" FOREIGN KEY ("overhead_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_variance_account_id_fkey" FOREIGN KEY ("variance_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "manufacturing_configurations" ADD CONSTRAINT "manufacturing_configurations_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_issue_journal_entry_id_fkey" FOREIGN KEY ("issue_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_completion_journal_entry_id_fkey" FOREIGN KEY ("completion_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_variance_journal_entry_id_fkey" FOREIGN KEY ("variance_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_order_lines" ADD CONSTRAINT "production_order_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_production_order_line_id_fkey" FOREIGN KEY ("production_order_line_id") REFERENCES "production_order_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_material_issues" ADD CONSTRAINT "production_material_issues_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_production_order_id_fkey" FOREIGN KEY ("production_order_id") REFERENCES "production_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "production_outputs" ADD CONSTRAINT "production_outputs_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
