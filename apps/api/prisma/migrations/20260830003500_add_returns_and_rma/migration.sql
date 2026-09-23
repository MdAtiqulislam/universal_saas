-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM (
  'CUSTOMER_RETURN',
  'SUPPLIER_RETURN',
  'INTERNAL_RETURN',
  'WARRANTY_RETURN',
  'REPLACEMENT_RETURN'
);

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'AUTHORIZED',
  'AWAITING_RETURN',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTION_REQUIRED',
  'INSPECTING',
  'DISPOSITION_PENDING',
  'RESOLVED',
  'CLOSED',
  'REJECTED',
  'CANCELLED',
  'VOIDED'
);

-- CreateEnum
CREATE TYPE "ReturnLineStatus" AS ENUM (
  'PENDING',
  'AUTHORIZED',
  'REJECTED',
  'IN_TRANSIT',
  'RECEIVED',
  'INSPECTED',
  'DISPOSITIONED',
  'RESOLVED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "ReturnDispositionType" AS ENUM (
  'RESTOCK',
  'REPAIR',
  'REWORK',
  'REPLACE',
  'SCRAP',
  'RETURN_TO_SUPPLIER',
  'REJECT_RETURN',
  'NO_ACTION'
);

-- CreateEnum
CREATE TYPE "ReturnResolutionType" AS ENUM (
  'NONE',
  'CREDIT_NOTE',
  'REFUND',
  'DEBIT_NOTE',
  'REPLACEMENT',
  'PARTIAL_CREDIT',
  'PARTIAL_REFUND'
);

-- CreateTable
CREATE TABLE "return_reasons" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "code" VARCHAR(50) NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "description" TEXT,
  "requires_inspection" BOOLEAN NOT NULL DEFAULT true,
  "default_disposition" "ReturnDispositionType" NOT NULL DEFAULT 'RESTOCK',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_policies" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "return_window_days" INTEGER NOT NULL DEFAULT 30,
  "require_original_shipment" BOOLEAN NOT NULL DEFAULT false,
  "require_original_invoice" BOOLEAN NOT NULL DEFAULT false,
  "allow_partial_returns" BOOLEAN NOT NULL DEFAULT true,
  "require_inspection" BOOLEAN NOT NULL DEFAULT true,
  "auto_quarantine" BOOLEAN NOT NULL DEFAULT true,
  "max_replacement_qty" DECIMAL(18,4) NOT NULL DEFAULT 100,
  "allow_restocking" BOOLEAN NOT NULL DEFAULT true,
  "auto_create_credit_note" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_requests" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "return_number" VARCHAR(50) NOT NULL,
  "return_type" "ReturnType" NOT NULL DEFAULT 'CUSTOMER_RETURN',
  "status" "ReturnStatus" NOT NULL DEFAULT 'DRAFT',
  "customer_id" UUID,
  "supplier_id" UUID,
  "sales_order_id" UUID,
  "delivery_order_id" UUID,
  "shipment_id" UUID,
  "reverse_shipment_id" UUID,
  "customer_invoice_id" UUID,
  "purchase_order_id" UUID,
  "goods_receipt_id" UUID,
  "supplier_invoice_id" UUID,
  "inspection_lot_id" UUID,
  "reason_id" UUID NOT NULL,
  "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "authorized_at" TIMESTAMPTZ(6),
  "authorized_by_user_id" UUID,
  "received_at" TIMESTAMPTZ(6),
  "resolved_at" TIMESTAMPTZ(6),
  "closed_at" TIMESTAMPTZ(6),
  "is_immutable" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "authorization_notes" TEXT,
  "rejection_reason" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_request_lines" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "return_request_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "variant_id" UUID,
  "source_line_id" UUID,
  "requested_quantity" DECIMAL(18,4) NOT NULL,
  "authorized_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "shipped_return_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "received_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "inspected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "accepted_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "rejected_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "replacement_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "financial_resolution_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "unit_price" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "line_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "reason_id" UUID,
  "status" "ReturnLineStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_dispositions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "return_request_id" UUID NOT NULL,
  "return_line_id" UUID NOT NULL,
  "disposition_type" "ReturnDispositionType" NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "inspection_lot_id" UUID,
  "reference_notes" TEXT,
  "processed_by_user_id" UUID NOT NULL,
  "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_dispositions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_resolutions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "return_request_id" UUID NOT NULL,
  "return_line_id" UUID,
  "resolution_type" "ReturnResolutionType" NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
  "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "customer_credit_note_id" UUID,
  "customer_refund_id" UUID,
  "supplier_debit_note_id" UUID,
  "replacement_sales_order_id" UUID,
  "replacement_reference" VARCHAR(100),
  "notes" TEXT,
  "processed_by_user_id" UUID NOT NULL,
  "processed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "return_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "return_reasons_organization_id_code_key" ON "return_reasons"("organization_id", "code");
CREATE INDEX "return_reasons_organization_id_is_active_idx" ON "return_reasons"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "return_policies_organization_id_key" ON "return_policies"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "return_requests_organization_id_return_number_key" ON "return_requests"("organization_id", "return_number");
CREATE INDEX "return_requests_organization_id_status_idx" ON "return_requests"("organization_id", "status");
CREATE INDEX "return_requests_organization_id_customer_id_idx" ON "return_requests"("organization_id", "customer_id");
CREATE INDEX "return_requests_organization_id_supplier_id_idx" ON "return_requests"("organization_id", "supplier_id");
CREATE INDEX "return_requests_organization_id_sales_order_id_idx" ON "return_requests"("organization_id", "sales_order_id");
CREATE INDEX "return_requests_organization_id_purchase_order_id_idx" ON "return_requests"("organization_id", "purchase_order_id");
CREATE INDEX "return_requests_organization_id_requested_at_idx" ON "return_requests"("organization_id", "requested_at");

-- CreateIndex
CREATE INDEX "return_request_lines_organization_id_return_request_id_idx" ON "return_request_lines"("organization_id", "return_request_id");
CREATE INDEX "return_request_lines_organization_id_item_id_idx" ON "return_request_lines"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "return_dispositions_organization_id_return_request_id_idx" ON "return_dispositions"("organization_id", "return_request_id");
CREATE INDEX "return_dispositions_organization_id_return_line_id_idx" ON "return_dispositions"("organization_id", "return_line_id");
CREATE INDEX "return_dispositions_organization_id_disposition_type_idx" ON "return_dispositions"("organization_id", "disposition_type");

-- CreateIndex
CREATE INDEX "return_resolutions_organization_id_return_request_id_idx" ON "return_resolutions"("organization_id", "return_request_id");
CREATE INDEX "return_resolutions_organization_id_resolution_type_idx" ON "return_resolutions"("organization_id", "resolution_type");
CREATE INDEX "return_resolutions_organization_id_customer_credit_note_id_idx" ON "return_resolutions"("organization_id", "customer_credit_note_id");
CREATE INDEX "return_resolutions_organization_id_customer_refund_id_idx" ON "return_resolutions"("organization_id", "customer_refund_id");
CREATE INDEX "return_resolutions_organization_id_supplier_debit_note_id_idx" ON "return_resolutions"("organization_id", "supplier_debit_note_id");

-- AddForeignKey
ALTER TABLE "return_reasons" ADD CONSTRAINT "return_reasons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_policies" ADD CONSTRAINT "return_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reverse_shipment_id_fkey" FOREIGN KEY ("reverse_shipment_id") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_requests" ADD CONSTRAINT "return_requests_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_request_lines" ADD CONSTRAINT "return_request_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_lines" ADD CONSTRAINT "return_request_lines_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_request_lines" ADD CONSTRAINT "return_request_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_lines" ADD CONSTRAINT "return_request_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_request_lines" ADD CONSTRAINT "return_request_lines_reason_id_fkey" FOREIGN KEY ("reason_id") REFERENCES "return_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_return_line_id_fkey" FOREIGN KEY ("return_line_id") REFERENCES "return_request_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "return_dispositions" ADD CONSTRAINT "return_dispositions_inspection_lot_id_fkey" FOREIGN KEY ("inspection_lot_id") REFERENCES "quality_inspection_lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_return_request_id_fkey" FOREIGN KEY ("return_request_id") REFERENCES "return_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_return_line_id_fkey" FOREIGN KEY ("return_line_id") REFERENCES "return_request_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_customer_credit_note_id_fkey" FOREIGN KEY ("customer_credit_note_id") REFERENCES "customer_credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_customer_refund_id_fkey" FOREIGN KEY ("customer_refund_id") REFERENCES "customer_refunds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_supplier_debit_note_id_fkey" FOREIGN KEY ("supplier_debit_note_id") REFERENCES "supplier_debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "return_resolutions" ADD CONSTRAINT "return_resolutions_replacement_sales_order_id_fkey" FOREIGN KEY ("replacement_sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
