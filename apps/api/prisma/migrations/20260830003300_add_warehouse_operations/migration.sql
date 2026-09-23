-- CreateEnum
CREATE TYPE "WarehouseLocationType" AS ENUM ('STORAGE', 'RECEIVING', 'PICKING', 'PACKING', 'QUARANTINE', 'DAMAGED', 'RETURN', 'SCRAP', 'PRODUCTION', 'STAGING', 'TRANSIT');

-- CreateEnum
CREATE TYPE "WarehouseTaskType" AS ENUM ('PUTAWAY', 'PICK', 'TRANSFER', 'COUNT', 'REPLENISHMENT');

-- CreateEnum
CREATE TYPE "WarehouseTaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickTaskStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'PARTIALLY_PICKED', 'PICKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PickWaveStatus" AS ENUM ('DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseTransferStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CycleCountStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COUNTED', 'REVIEWED', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuarantineStatus" AS ENUM ('QUARANTINED', 'UNDER_INSPECTION', 'RELEASED', 'HELD', 'SCRAPPED', 'RETURNED');

-- CreateEnum
CREATE TYPE "ReplenishmentStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterTable
ALTER TABLE "locations" ADD COLUMN "location_type" "WarehouseLocationType" DEFAULT 'STORAGE';

-- CreateIndex
CREATE INDEX "locations_organization_id_location_type_idx" ON "locations"("organization_id", "location_type");

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "zone_type" VARCHAR(50) NOT NULL DEFAULT 'STORAGE',
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_number" VARCHAR(50) NOT NULL,
    "task_type" "WarehouseTaskType" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "status" "WarehouseTaskStatus" NOT NULL DEFAULT 'PENDING',
    "warehouse_id" UUID NOT NULL,
    "source_location_id" UUID,
    "target_location_id" UUID,
    "assigned_user_id" UUID,
    "completed_by_user_id" UUID,
    "source_document_type" VARCHAR(50),
    "source_document_id" VARCHAR(100),
    "notes" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putaway_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_number" VARCHAR(50) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "source_location_id" UUID NOT NULL,
    "target_location_id" UUID,
    "source_document_type" VARCHAR(50),
    "source_document_id" VARCHAR(100),
    "status" "WarehouseTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "assigned_user_id" UUID,
    "completed_by_user_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "putaway_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "putaway_task_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "putaway_task_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "batch_id" UUID,
    "serial_id" UUID,
    "suggested_location_id" UUID,
    "actual_location_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" "WarehouseTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "putaway_task_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_number" VARCHAR(50) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "sales_order_id" UUID,
    "delivery_order_id" UUID,
    "staging_location_id" UUID,
    "wave_id" UUID,
    "status" "PickTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "assigned_user_id" UUID,
    "completed_by_user_id" UUID,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pick_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_task_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "pick_task_id" UUID NOT NULL,
    "sales_order_line_id" UUID,
    "delivery_order_line_id" UUID,
    "reservation_id" UUID,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "source_location_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(18,4) NOT NULL,
    "picked_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "batch_id" UUID,
    "serial_id" UUID,
    "status" "PickTaskStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pick_task_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_waves" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "wave_number" VARCHAR(50) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "status" "PickWaveStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "criteria" JSONB,
    "released_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pick_waves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pick_wave_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "wave_id" UUID NOT NULL,
    "pick_task_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pick_wave_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_number" VARCHAR(50) NOT NULL,
    "source_warehouse_id" UUID NOT NULL,
    "destination_warehouse_id" UUID NOT NULL,
    "status" "WarehouseTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "submitted_by_user_id" UUID,
    "approved_by_user_id" UUID,
    "completed_by_user_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_transfer_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "source_location_id" UUID NOT NULL,
    "destination_location_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "batch_id" UUID,
    "serial_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_counts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "count_number" VARCHAR(50) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "zone_id" UUID,
    "status" "CycleCountStatus" NOT NULL DEFAULT 'DRAFT',
    "is_blind" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "assigned_counter_user_id" UUID,
    "reviewed_by_user_id" UUID,
    "posted_by_user_id" UUID,
    "scheduled_date" TIMESTAMPTZ(6),
    "counted_at" TIMESTAMPTZ(6),
    "reviewed_at" TIMESTAMPTZ(6),
    "posted_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_lines" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "cycle_count_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "batch_id" UUID,
    "serial_id" UUID,
    "system_quantity" DECIMAL(18,4) NOT NULL,
    "counted_quantity" DECIMAL(18,4),
    "variance_quantity" DECIMAL(18,4),
    "unit_cost" DECIMAL(18,4),
    "variance_value" DECIMAL(18,4),
    "recount_quantity" DECIMAL(18,4),
    "notes" TEXT,
    "counted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "source_location_id" UUID NOT NULL,
    "destination_location_id" UUID NOT NULL,
    "min_quantity" DECIMAL(18,4) NOT NULL,
    "max_quantity" DECIMAL(18,4) NOT NULL,
    "replenish_quantity" DECIMAL(18,4) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "replenishment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "replenishment_tasks" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "task_number" VARCHAR(50) NOT NULL,
    "rule_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "source_location_id" UUID NOT NULL,
    "destination_location_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" "ReplenishmentStatus" NOT NULL DEFAULT 'PENDING',
    "assigned_user_id" UUID,
    "completed_by_user_id" UUID,
    "completed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "replenishment_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantine_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "quarantine_number" VARCHAR(50) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "batch_id" UUID,
    "serial_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" "QuarantineStatus" NOT NULL DEFAULT 'QUARANTINED',
    "reason" TEXT NOT NULL,
    "source_document_type" VARCHAR(50),
    "source_document_id" VARCHAR(100),
    "disposition" VARCHAR(50),
    "disposition_notes" TEXT,
    "inspected_by_user_id" UUID,
    "inspected_at" TIMESTAMPTZ(6),
    "released_by_user_id" UUID,
    "released_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "quarantine_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_configurations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "default_receiving_location_id" UUID,
    "default_staging_location_id" UUID,
    "default_quarantine_location_id" UUID,
    "default_scrap_location_id" UUID,
    "default_return_location_id" UUID,
    "default_pick_location_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "warehouse_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "warehouse_zones_organization_id_location_id_code_key" ON "warehouse_zones"("organization_id", "location_id", "code");
CREATE INDEX "warehouse_zones_organization_id_location_id_idx" ON "warehouse_zones"("organization_id", "location_id");

CREATE UNIQUE INDEX "warehouse_tasks_organization_id_task_number_key" ON "warehouse_tasks"("organization_id", "task_number");
CREATE INDEX "warehouse_tasks_organization_id_status_idx" ON "warehouse_tasks"("organization_id", "status");
CREATE INDEX "warehouse_tasks_organization_id_warehouse_id_idx" ON "warehouse_tasks"("organization_id", "warehouse_id");

CREATE UNIQUE INDEX "putaway_tasks_organization_id_task_number_key" ON "putaway_tasks"("organization_id", "task_number");
CREATE INDEX "putaway_tasks_organization_id_status_idx" ON "putaway_tasks"("organization_id", "status");
CREATE INDEX "putaway_tasks_organization_id_warehouse_id_idx" ON "putaway_tasks"("organization_id", "warehouse_id");

CREATE INDEX "putaway_task_lines_organization_id_putaway_task_id_idx" ON "putaway_task_lines"("organization_id", "putaway_task_id");
CREATE INDEX "putaway_task_lines_organization_id_item_id_idx" ON "putaway_task_lines"("organization_id", "item_id");

CREATE UNIQUE INDEX "pick_tasks_organization_id_task_number_key" ON "pick_tasks"("organization_id", "task_number");
CREATE INDEX "pick_tasks_organization_id_status_idx" ON "pick_tasks"("organization_id", "status");
CREATE INDEX "pick_tasks_organization_id_warehouse_id_idx" ON "pick_tasks"("organization_id", "warehouse_id");
CREATE INDEX "pick_tasks_organization_id_wave_id_idx" ON "pick_tasks"("organization_id", "wave_id");

CREATE INDEX "pick_task_lines_organization_id_pick_task_id_idx" ON "pick_task_lines"("organization_id", "pick_task_id");
CREATE INDEX "pick_task_lines_organization_id_item_id_idx" ON "pick_task_lines"("organization_id", "item_id");

CREATE UNIQUE INDEX "pick_waves_organization_id_wave_number_key" ON "pick_waves"("organization_id", "wave_number");
CREATE INDEX "pick_waves_organization_id_status_idx" ON "pick_waves"("organization_id", "status");
CREATE INDEX "pick_waves_organization_id_warehouse_id_idx" ON "pick_waves"("organization_id", "warehouse_id");

CREATE UNIQUE INDEX "pick_wave_lines_wave_id_pick_task_id_key" ON "pick_wave_lines"("wave_id", "pick_task_id");
CREATE INDEX "pick_wave_lines_organization_id_wave_id_idx" ON "pick_wave_lines"("organization_id", "wave_id");

CREATE UNIQUE INDEX "warehouse_transfers_organization_id_transfer_number_key" ON "warehouse_transfers"("organization_id", "transfer_number");
CREATE INDEX "warehouse_transfers_organization_id_status_idx" ON "warehouse_transfers"("organization_id", "status");
CREATE INDEX "warehouse_transfers_organization_id_source_warehouse_id_idx" ON "warehouse_transfers"("organization_id", "source_warehouse_id");
CREATE INDEX "warehouse_transfers_organization_id_destination_warehouse_i_idx" ON "warehouse_transfers"("organization_id", "destination_warehouse_id");

CREATE INDEX "warehouse_transfer_lines_organization_id_transfer_id_idx" ON "warehouse_transfer_lines"("organization_id", "transfer_id");
CREATE INDEX "warehouse_transfer_lines_organization_id_item_id_idx" ON "warehouse_transfer_lines"("organization_id", "item_id");

CREATE UNIQUE INDEX "cycle_counts_organization_id_count_number_key" ON "cycle_counts"("organization_id", "count_number");
CREATE INDEX "cycle_counts_organization_id_status_idx" ON "cycle_counts"("organization_id", "status");
CREATE INDEX "cycle_counts_organization_id_warehouse_id_idx" ON "cycle_counts"("organization_id", "warehouse_id");

CREATE INDEX "cycle_count_lines_organization_id_cycle_count_id_idx" ON "cycle_count_lines"("organization_id", "cycle_count_id");
CREATE INDEX "cycle_count_lines_organization_id_location_id_item_id_idx" ON "cycle_count_lines"("organization_id", "location_id", "item_id");

CREATE UNIQUE INDEX "replenishment_rules_organization_id_item_id_variant_id_des_key" ON "replenishment_rules"("organization_id", "item_id", "variant_id", "destination_location_id");
CREATE INDEX "replenishment_rules_organization_id_warehouse_id_idx" ON "replenishment_rules"("organization_id", "warehouse_id");

CREATE UNIQUE INDEX "replenishment_tasks_organization_id_task_number_key" ON "replenishment_tasks"("organization_id", "task_number");
CREATE INDEX "replenishment_tasks_organization_id_status_idx" ON "replenishment_tasks"("organization_id", "status");
CREATE INDEX "replenishment_tasks_organization_id_warehouse_id_idx" ON "replenishment_tasks"("organization_id", "warehouse_id");

CREATE UNIQUE INDEX "quarantine_records_organization_id_quarantine_number_key" ON "quarantine_records"("organization_id", "quarantine_number");
CREATE INDEX "quarantine_records_organization_id_status_idx" ON "quarantine_records"("organization_id", "status");
CREATE INDEX "quarantine_records_organization_id_warehouse_id_idx" ON "quarantine_records"("organization_id", "warehouse_id");

CREATE UNIQUE INDEX "warehouse_configurations_organization_id_key" ON "warehouse_configurations"("organization_id");

-- AddForeignKeys
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_tasks" ADD CONSTRAINT "warehouse_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "putaway_tasks" ADD CONSTRAINT "putaway_tasks_target_location_id_fkey" FOREIGN KEY ("target_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_putaway_task_id_fkey" FOREIGN KEY ("putaway_task_id") REFERENCES "putaway_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "putaway_task_lines" ADD CONSTRAINT "putaway_task_lines_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_staging_location_id_fkey" FOREIGN KEY ("staging_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_tasks" ADD CONSTRAINT "pick_tasks_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "pick_waves"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_pick_task_id_fkey" FOREIGN KEY ("pick_task_id") REFERENCES "pick_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_delivery_order_line_id_fkey" FOREIGN KEY ("delivery_order_line_id") REFERENCES "delivery_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "inventory_reservations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pick_task_lines" ADD CONSTRAINT "pick_task_lines_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pick_waves" ADD CONSTRAINT "pick_waves_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_waves" ADD CONSTRAINT "pick_waves_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pick_wave_lines" ADD CONSTRAINT "pick_wave_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_wave_lines" ADD CONSTRAINT "pick_wave_lines_wave_id_fkey" FOREIGN KEY ("wave_id") REFERENCES "pick_waves"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pick_wave_lines" ADD CONSTRAINT "pick_wave_lines_pick_task_id_fkey" FOREIGN KEY ("pick_task_id") REFERENCES "pick_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_source_warehouse_id_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfers" ADD CONSTRAINT "warehouse_transfers_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "warehouse_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_transfer_lines" ADD CONSTRAINT "warehouse_transfer_lines_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_cycle_count_id_fkey" FOREIGN KEY ("cycle_count_id") REFERENCES "cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_rules" ADD CONSTRAINT "replenishment_rules_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "replenishment_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "replenishment_tasks" ADD CONSTRAINT "replenishment_tasks_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_receiving_location_id_fkey" FOREIGN KEY ("default_receiving_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_staging_location_id_fkey" FOREIGN KEY ("default_staging_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_quarantine_location_id_fkey" FOREIGN KEY ("default_quarantine_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_scrap_location_id_fkey" FOREIGN KEY ("default_scrap_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_return_location_id_fkey" FOREIGN KEY ("default_return_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "warehouse_configurations" ADD CONSTRAINT "warehouse_configurations_default_pick_location_id_fkey" FOREIGN KEY ("default_pick_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
