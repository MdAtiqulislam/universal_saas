-- AlterEnum
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'SENT';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'ACKNOWLEDGED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'REJECTED';
ALTER TYPE "PurchaseOrderStatus" ADD VALUE 'VOIDED';

-- CreateEnum
CREATE TYPE "PurchaseRequisitionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'CONVERTED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PurchaseReturnStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "purchase_orders" ADD COLUMN "supplier_reference" VARCHAR(100),
ADD COLUMN "requisition_id" UUID,
ADD COLUMN "planned_order_id" UUID,
ADD COLUMN "shipping_terms" VARCHAR(100),
ADD COLUMN "acknowledged_at" TIMESTAMPTZ(6),
ADD COLUMN "confirmed_delivery_date" TIMESTAMPTZ(6),
ADD COLUMN "confirmed_quantity" DECIMAL(18,4),
ADD COLUMN "supplier_notes" TEXT;

-- AlterTable
ALTER TABLE "purchase_order_lines" ADD COLUMN "cancelled_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN "remaining_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
ADD COLUMN "required_date" DATE,
ADD COLUMN "expected_receipt_date" DATE;

-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN "supplier_id" UUID;

-- AlterTable
ALTER TABLE "goods_receipt_lines" ADD COLUMN "inventory_movement_id" UUID,
ADD COLUMN "cost_layer_id" UUID;

-- CreateTable
CREATE TABLE "purchase_requisitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requisition_number" VARCHAR(50) NOT NULL,
    "requester_id" UUID NOT NULL,
    "department_id" UUID,
    "supplier_id" UUID,
    "location_id" UUID,
    "currency_id" UUID,
    "required_date" DATE NOT NULL,
    "status" "PurchaseRequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "source_planned_order_id" UUID,
    "source_planning_run_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_requisition_lines" (
    "id" UUID NOT NULL,
    "requisition_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "estimated_unit_price" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "estimated_total" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "required_date" DATE NOT NULL,
    "source_planning_result_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_returns" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "return_number" VARCHAR(50) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "purchase_order_id" UUID NOT NULL,
    "goods_receipt_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "return_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "PurchaseReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "purchase_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_return_lines" (
    "id" UUID NOT NULL,
    "purchase_return_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "goods_receipt_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "inventory_movement_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_return_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "purchase_requisitions_organization_id_requisition_number_key" ON "purchase_requisitions"("organization_id", "requisition_number");
CREATE INDEX "purchase_requisitions_organization_id_status_idx" ON "purchase_requisitions"("organization_id", "status");
CREATE INDEX "purchase_requisitions_organization_id_source_planned_order__idx" ON "purchase_requisitions"("organization_id", "source_planned_order_id");

-- CreateIndex
CREATE INDEX "purchase_requisition_lines_organization_id_requisition_id_idx" ON "purchase_requisition_lines"("organization_id", "requisition_id");
CREATE INDEX "purchase_requisition_lines_organization_id_item_id_idx" ON "purchase_requisition_lines"("organization_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_returns_organization_id_return_number_key" ON "purchase_returns"("organization_id", "return_number");
CREATE INDEX "purchase_returns_organization_id_status_idx" ON "purchase_returns"("organization_id", "status");
CREATE INDEX "purchase_returns_organization_id_purchase_order_id_idx" ON "purchase_returns"("organization_id", "purchase_order_id");
CREATE INDEX "purchase_returns_organization_id_goods_receipt_id_idx" ON "purchase_returns"("organization_id", "goods_receipt_id");

-- CreateIndex
CREATE INDEX "purchase_return_lines_organization_id_purchase_return_id_idx" ON "purchase_return_lines"("organization_id", "purchase_return_id");

-- CreateIndex
CREATE INDEX "purchase_orders_organization_id_requisition_id_idx" ON "purchase_orders"("organization_id", "requisition_id");

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_planned_order_id_fkey" FOREIGN KEY ("planned_order_id") REFERENCES "planned_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_source_planned_order_id_fkey" FOREIGN KEY ("source_planned_order_id") REFERENCES "planned_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_source_planning_run_id_fkey" FOREIGN KEY ("source_planning_run_id") REFERENCES "planning_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "purchase_requisition_lines" ADD CONSTRAINT "purchase_requisition_lines_source_planning_result_id_fkey" FOREIGN KEY ("source_planning_result_id") REFERENCES "planning_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchase_return_id_fkey" FOREIGN KEY ("purchase_return_id") REFERENCES "purchase_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
