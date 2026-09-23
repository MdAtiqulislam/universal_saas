-- CreateEnum
CREATE TYPE "SerialStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD', 'DAMAGED', 'LOST', 'TRANSFERRED');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('RECEIPT', 'ISSUE', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "quantity_reserved" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "batch_number" VARCHAR(100) NOT NULL,
    "manufactured_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_serials" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "serial_number" VARCHAR(100) NOT NULL,
    "status" "SerialStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inventory_serials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "batch_id" UUID,
    "serial_id" UUID,
    "reference_type" VARCHAR(50),
    "reference_id" VARCHAR(100),
    "reason" TEXT,
    "actor_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "transfer_number" VARCHAR(50) NOT NULL,
    "source_location_id" UUID NOT NULL,
    "destination_location_id" UUID NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_organization_id_location_id_item_id_variant_id_key" ON "inventory_balances"("organization_id", "location_id", "item_id", "variant_id");

-- CreateIndex
CREATE INDEX "inventory_balances_organization_id_item_id_idx" ON "inventory_balances"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "inventory_balances_organization_id_location_id_idx" ON "inventory_balances"("organization_id", "location_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_batches_organization_id_item_id_variant_id_location_id_batch_number_key" ON "inventory_batches"("organization_id", "item_id", "variant_id", "location_id", "batch_number");

-- CreateIndex
CREATE INDEX "inventory_batches_organization_id_batch_number_idx" ON "inventory_batches"("organization_id", "batch_number");

-- CreateIndex
CREATE INDEX "inventory_batches_organization_id_expires_at_idx" ON "inventory_batches"("organization_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_serials_organization_id_serial_number_key" ON "inventory_serials"("organization_id", "serial_number");

-- CreateIndex
CREATE INDEX "inventory_serials_organization_id_item_id_idx" ON "inventory_serials"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "inventory_serials_organization_id_location_id_idx" ON "inventory_serials"("organization_id", "location_id");

-- CreateIndex
CREATE INDEX "inventory_serials_organization_id_status_idx" ON "inventory_serials"("organization_id", "status");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_created_at_idx" ON "stock_movements"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_item_id_idx" ON "stock_movements"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_location_id_idx" ON "stock_movements"("organization_id", "location_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_reference_type_reference_id_idx" ON "stock_movements"("organization_id", "reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organization_id_transfer_number_key" ON "stock_transfers"("organization_id", "transfer_number");

-- CreateIndex
CREATE INDEX "stock_transfers_organization_id_created_at_idx" ON "stock_transfers"("organization_id", "created_at");

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_serials" ADD CONSTRAINT "inventory_serials_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_serial_id_fkey" FOREIGN KEY ("serial_id") REFERENCES "inventory_serials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destination_location_id_fkey" FOREIGN KEY ("destination_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Database Check Constraints
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_non_negative_on_hand" CHECK ("quantity_on_hand" >= 0);
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_non_negative_reserved" CHECK ("quantity_reserved" >= 0);
ALTER TABLE "inventory_batches" ADD CONSTRAINT "inventory_batches_non_negative_qty" CHECK ("quantity" >= 0);
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_positive_qty" CHECK ("quantity" > 0);
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_distinct_locations" CHECK ("source_location_id" != "destination_location_id");
