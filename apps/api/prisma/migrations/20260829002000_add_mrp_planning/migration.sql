-- CreateEnum
CREATE TYPE "PlanningRunStatus" AS ENUM ('DRAFT', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanningDemandSource" AS ENUM ('SALES_ORDER', 'PRODUCTION_ORDER', 'SAFETY_STOCK', 'MANUAL');

-- CreateEnum
CREATE TYPE "PlanningSupplySource" AS ENUM ('ON_HAND', 'PURCHASE_ORDER', 'PRODUCTION_ORDER');

-- CreateEnum
CREATE TYPE "PlannedOrderAction" AS ENUM ('PURCHASE', 'PRODUCTION', 'EXPEDITE', 'SHORTAGE');

-- CreateEnum
CREATE TYPE "PlannedOrderStatus" AS ENUM ('SUGGESTED', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "planning_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "default_planning_horizon_days" INTEGER NOT NULL DEFAULT 30,
    "default_lead_time_days" INTEGER NOT NULL DEFAULT 7,
    "default_safety_stock" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "include_sales_orders" BOOLEAN NOT NULL DEFAULT true,
    "include_production_orders" BOOLEAN NOT NULL DEFAULT true,
    "include_safety_stock" BOOLEAN NOT NULL DEFAULT true,
    "default_location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planning_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_planning_profiles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "lead_time_days" INTEGER NOT NULL DEFAULT 7,
    "safety_stock" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reorder_point" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "min_order_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "max_order_quantity" DECIMAL(18,4),
    "order_multiple" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "preferred_supplier_id" UUID,
    "preferred_bom_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_planning_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "location_id" UUID,
    "item_id" UUID,
    "status" "PlanningRunStatus" NOT NULL DEFAULT 'DRAFT',
    "include_sales_orders" BOOLEAN NOT NULL DEFAULT true,
    "include_production_orders" BOOLEAN NOT NULL DEFAULT true,
    "include_safety_stock" BOOLEAN NOT NULL DEFAULT true,
    "total_demand_count" INTEGER NOT NULL DEFAULT 0,
    "total_supply_count" INTEGER NOT NULL DEFAULT 0,
    "total_result_count" INTEGER NOT NULL DEFAULT 0,
    "total_shortage_count" INTEGER NOT NULL DEFAULT 0,
    "total_planned_order_count" INTEGER NOT NULL DEFAULT 0,
    "execution_started_at" TIMESTAMPTZ(6),
    "execution_completed_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planning_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_demands" (
    "id" UUID NOT NULL,
    "planning_run_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_type" "PlanningDemandSource" NOT NULL,
    "source_id" UUID,
    "source_number" VARCHAR(100),
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID,
    "required_date" DATE NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_supplies" (
    "id" UUID NOT NULL,
    "planning_run_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "source_type" "PlanningSupplySource" NOT NULL,
    "source_id" UUID,
    "source_number" VARCHAR(100),
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID,
    "available_date" DATE NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_supplies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planning_results" (
    "id" UUID NOT NULL,
    "planning_run_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID,
    "gross_requirement" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "on_hand_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "reserved_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "available_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "expected_supply_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "safety_stock_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "net_requirement" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "required_date" DATE NOT NULL,
    "suggested_action" "PlannedOrderAction" NOT NULL,
    "suggested_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "planned_order_date" DATE,
    "planned_receipt_date" DATE,
    "explosion_level" INTEGER NOT NULL DEFAULT 0,
    "source_references" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "planning_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planned_orders" (
    "id" UUID NOT NULL,
    "planning_run_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "action" "PlannedOrderAction" NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "required_date" DATE NOT NULL,
    "planned_order_date" DATE NOT NULL,
    "planned_receipt_date" DATE NOT NULL,
    "supplier_id" UUID,
    "bom_id" UUID,
    "status" "PlannedOrderStatus" NOT NULL DEFAULT 'SUGGESTED',
    "reason" TEXT,
    "source_demand_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "planned_orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "planning_configurations_organization_id_key" ON "planning_configurations"("organization_id");

-- CreateIndex
CREATE INDEX "item_planning_profiles_organization_id_item_id_idx" ON "item_planning_profiles"("organization_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "planning_runs_organization_id_run_number_key" ON "planning_runs"("organization_id", "run_number");

-- CreateIndex
CREATE INDEX "planning_runs_organization_id_status_idx" ON "planning_runs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "planning_demands_organization_id_planning_run_id_idx" ON "planning_demands"("organization_id", "planning_run_id");

-- CreateIndex
CREATE INDEX "planning_demands_organization_id_item_id_idx" ON "planning_demands"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "planning_supplies_organization_id_planning_run_id_idx" ON "planning_supplies"("organization_id", "planning_run_id");

-- CreateIndex
CREATE INDEX "planning_supplies_organization_id_item_id_idx" ON "planning_supplies"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "planning_results_organization_id_planning_run_id_idx" ON "planning_results"("organization_id", "planning_run_id");

-- CreateIndex
CREATE INDEX "planning_results_organization_id_item_id_idx" ON "planning_results"("organization_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "planned_orders_organization_id_order_number_key" ON "planned_orders"("organization_id", "order_number");

-- CreateIndex
CREATE INDEX "planned_orders_organization_id_planning_run_id_idx" ON "planned_orders"("organization_id", "planning_run_id");

-- CreateIndex
CREATE INDEX "planned_orders_organization_id_item_id_idx" ON "planned_orders"("organization_id", "item_id");

-- AddForeignKey
ALTER TABLE "planning_configurations" ADD CONSTRAINT "planning_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_configurations" ADD CONSTRAINT "planning_configurations_default_location_id_fkey" FOREIGN KEY ("default_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_planning_profiles" ADD CONSTRAINT "item_planning_profiles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_planning_profiles" ADD CONSTRAINT "item_planning_profiles_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_planning_profiles" ADD CONSTRAINT "item_planning_profiles_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_planning_profiles" ADD CONSTRAINT "item_planning_profiles_preferred_supplier_id_fkey" FOREIGN KEY ("preferred_supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_planning_profiles" ADD CONSTRAINT "item_planning_profiles_preferred_bom_id_fkey" FOREIGN KEY ("preferred_bom_id") REFERENCES "bill_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_runs" ADD CONSTRAINT "planning_runs_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_demands" ADD CONSTRAINT "planning_demands_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_supplies" ADD CONSTRAINT "planning_supplies_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_results" ADD CONSTRAINT "planning_results_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_results" ADD CONSTRAINT "planning_results_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_results" ADD CONSTRAINT "planning_results_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_results" ADD CONSTRAINT "planning_results_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planning_results" ADD CONSTRAINT "planning_results_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_planning_run_id_fkey" FOREIGN KEY ("planning_run_id") REFERENCES "planning_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_bom_id_fkey" FOREIGN KEY ("bom_id") REFERENCES "bill_of_materials"("id") ON DELETE SET NULL ON UPDATE CASCADE;
