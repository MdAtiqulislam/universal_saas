-- ==============================================================================
-- MILESTONE M13: ACCOUNTS PAYABLE & SUPPLIER INVOICING
-- Migration: 20260828000800_add_accounts_payable
-- ==============================================================================

-- Create Enum Types for Accounts Payable
CREATE TYPE "SupplierInvoiceStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'POSTED',
  'PARTIALLY_PAID',
  'PAID',
  'VOIDED',
  'CANCELLED'
);

-- ------------------------------------------------------------------------------
-- 1. Accounting Account Mappings Table
-- ------------------------------------------------------------------------------
CREATE TABLE "accounting_account_mappings" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "key" VARCHAR(100) NOT NULL,
  "account_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounting_account_mappings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "accounting_account_mappings_organization_id_key_key" ON "accounting_account_mappings"("organization_id", "key");
CREATE INDEX "accounting_account_mappings_organization_id_account_id_idx" ON "accounting_account_mappings"("organization_id", "account_id");

ALTER TABLE "accounting_account_mappings" ADD CONSTRAINT "accounting_account_mappings_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting_account_mappings" ADD CONSTRAINT "accounting_account_mappings_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------------------
-- 2. Supplier Invoices Table
-- ------------------------------------------------------------------------------
CREATE TABLE "supplier_invoices" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "invoice_number" VARCHAR(50) NOT NULL,
  "invoice_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "currency_id" UUID NOT NULL,
  "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "amount_paid" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "amount_due" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "purchase_order_id" UUID,
  "goods_receipt_id" UUID,
  "notes" TEXT,
  "source_reference" VARCHAR(100),
  "created_by_user_id" UUID NOT NULL,
  "posted_by_user_id" UUID,
  "posted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "supplier_invoices_organization_id_invoice_number_key" ON "supplier_invoices"("organization_id", "invoice_number");
CREATE INDEX "supplier_invoices_organization_id_supplier_id_idx" ON "supplier_invoices"("organization_id", "supplier_id");
CREATE INDEX "supplier_invoices_organization_id_status_idx" ON "supplier_invoices"("organization_id", "status");
CREATE INDEX "supplier_invoices_organization_id_purchase_order_id_idx" ON "supplier_invoices"("organization_id", "purchase_order_id");
CREATE INDEX "supplier_invoices_organization_id_goods_receipt_id_idx" ON "supplier_invoices"("organization_id", "goods_receipt_id");
CREATE INDEX "supplier_invoices_organization_id_invoice_date_idx" ON "supplier_invoices"("organization_id", "invoice_date");

ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "supplier_invoices_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_invoices" ADD CONSTRAINT "chk_supplier_invoice_totals" CHECK ("grand_total" >= 0 AND "amount_paid" >= 0 AND "amount_due" >= 0);
ALTER TABLE "supplier_invoices" ADD CONSTRAINT "chk_supplier_invoice_due_balance" CHECK ("amount_due" = "grand_total" - "amount_paid");

-- ------------------------------------------------------------------------------
-- 3. Supplier Invoice Lines Table
-- ------------------------------------------------------------------------------
CREATE TABLE "supplier_invoice_lines" (
  "id" UUID NOT NULL,
  "supplier_invoice_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "variant_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(18, 4) NOT NULL,
  "unit_price" DECIMAL(20, 4) NOT NULL,
  "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(12, 4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(20, 4) NOT NULL,
  "purchase_order_line_id" UUID,
  "goods_receipt_line_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "supplier_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "supplier_invoice_lines_organization_id_supplier_invoice_id_idx" ON "supplier_invoice_lines"("organization_id", "supplier_invoice_id");
CREATE INDEX "supplier_invoice_lines_organization_id_item_id_idx" ON "supplier_invoice_lines"("organization_id", "item_id");
CREATE INDEX "supplier_invoice_lines_organization_id_purchase_order_line_id_idx" ON "supplier_invoice_lines"("organization_id", "purchase_order_line_id");
CREATE INDEX "supplier_invoice_lines_organization_id_goods_receipt_line_id_idx" ON "supplier_invoice_lines"("organization_id", "goods_receipt_line_id");

ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "supplier_invoice_lines_goods_receipt_line_id_fkey" FOREIGN KEY ("goods_receipt_line_id") REFERENCES "goods_receipt_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "chk_supplier_invoice_line_qty" CHECK ("quantity" > 0);
ALTER TABLE "supplier_invoice_lines" ADD CONSTRAINT "chk_supplier_invoice_line_amounts" CHECK ("unit_price" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0);
