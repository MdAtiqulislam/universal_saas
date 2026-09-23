-- ==============================================================================
-- MILESTONE M14: ACCOUNTS RECEIVABLE & CUSTOMER INVOICING
-- Migration: 20260828000900_add_accounts_receivable
-- ==============================================================================

-- Create Enum Types for Accounts Receivable
CREATE TYPE "CustomerInvoiceStatus" AS ENUM (
  'DRAFT',
  'ISSUED',
  'PARTIALLY_PAID',
  'PAID',
  'VOIDED',
  'CANCELLED'
);

-- ------------------------------------------------------------------------------
-- 1. Customer Invoices Table
-- ------------------------------------------------------------------------------
CREATE TABLE "customer_invoices" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "invoice_number" VARCHAR(50) NOT NULL,
  "invoice_date" DATE NOT NULL,
  "due_date" DATE NOT NULL,
  "payment_terms_days" INTEGER NOT NULL DEFAULT 0,
  "currency_id" UUID NOT NULL,
  "status" "CustomerInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "subtotal" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "grand_total" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "amount_paid" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "amount_due" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "sales_order_id" UUID,
  "delivery_order_id" UUID,
  "notes" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "issued_by_user_id" UUID,
  "issued_at" TIMESTAMPTZ(6),
  "voided_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMPTZ(6),

  CONSTRAINT "customer_invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_invoices_organization_id_invoice_number_key" ON "customer_invoices"("organization_id", "invoice_number");
CREATE INDEX "customer_invoices_organization_id_customer_id_idx" ON "customer_invoices"("organization_id", "customer_id");
CREATE INDEX "customer_invoices_organization_id_status_idx" ON "customer_invoices"("organization_id", "status");
CREATE INDEX "customer_invoices_organization_id_sales_order_id_idx" ON "customer_invoices"("organization_id", "sales_order_id");
CREATE INDEX "customer_invoices_organization_id_delivery_order_id_idx" ON "customer_invoices"("organization_id", "delivery_order_id");
CREATE INDEX "customer_invoices_organization_id_invoice_date_idx" ON "customer_invoices"("organization_id", "invoice_date");
CREATE INDEX "customer_invoices_organization_id_due_date_idx" ON "customer_invoices"("organization_id", "due_date");

ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_invoices" ADD CONSTRAINT "customer_invoices_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_invoices" ADD CONSTRAINT "chk_customer_invoice_totals" CHECK ("grand_total" >= 0 AND "amount_paid" >= 0 AND "amount_due" >= 0);
ALTER TABLE "customer_invoices" ADD CONSTRAINT "chk_customer_invoice_due_balance" CHECK ("amount_due" = "grand_total" - "amount_paid");

-- ------------------------------------------------------------------------------
-- 2. Customer Invoice Lines Table
-- ------------------------------------------------------------------------------
CREATE TABLE "customer_invoice_lines" (
  "id" UUID NOT NULL,
  "customer_invoice_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "variant_id" UUID,
  "sales_order_line_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(18, 4) NOT NULL,
  "unit_price" DECIMAL(20, 4) NOT NULL,
  "discount_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(12, 4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(20, 4) NOT NULL DEFAULT 0,
  "line_total" DECIMAL(20, 4) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "customer_invoice_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "customer_invoice_lines_organization_id_customer_invoice_id_idx" ON "customer_invoice_lines"("organization_id", "customer_invoice_id");
CREATE INDEX "customer_invoice_lines_organization_id_item_id_idx" ON "customer_invoice_lines"("organization_id", "item_id");
CREATE INDEX "customer_invoice_lines_organization_id_sales_order_line_id_idx" ON "customer_invoice_lines"("organization_id", "sales_order_line_id");

ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "customer_invoice_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "chk_customer_invoice_line_qty" CHECK ("quantity" > 0);
ALTER TABLE "customer_invoice_lines" ADD CONSTRAINT "chk_customer_invoice_line_amounts" CHECK ("unit_price" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0);
