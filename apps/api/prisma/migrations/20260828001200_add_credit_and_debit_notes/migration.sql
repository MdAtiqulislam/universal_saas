-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'PARTIALLY_APPLIED', 'APPLIED', 'VOIDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DebitNoteStatus" AS ENUM ('DRAFT', 'APPROVED', 'POSTED', 'PARTIALLY_APPLIED', 'APPLIED', 'VOIDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "ReturnDisposition" AS ENUM ('RESTOCK', 'SCRAP');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('DRAFT', 'POSTED', 'VOIDED');

-- CreateTable
CREATE TABLE "customer_credit_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_note_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "customer_invoice_id" UUID,
    "sales_order_id" UUID,
    "delivery_order_id" UUID,
    "currency_id" UUID NOT NULL,
    "credit_date" DATE NOT NULL,
    "reason" VARCHAR(255),
    "notes" TEXT,
    "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "applied_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "posted_by_user_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "journal_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_note_lines" (
    "id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "customer_invoice_line_id" UUID,
    "description" VARCHAR(255),
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(20,4) NOT NULL,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(20,4) NOT NULL,
    "return_to_inventory" BOOLEAN NOT NULL DEFAULT false,
    "disposition" "ReturnDisposition",
    "location_id" UUID,
    "batch_number" VARCHAR(100),
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "line_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_credit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "credit_note_id" UUID NOT NULL,
    "customer_invoice_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "customer_credit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_refunds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "refund_number" VARCHAR(50) NOT NULL,
    "customer_id" UUID NOT NULL,
    "credit_note_id" UUID,
    "payment_account_id" UUID NOT NULL,
    "currency_id" UUID NOT NULL,
    "refund_date" DATE NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "reason" VARCHAR(255),
    "reference" VARCHAR(100),
    "notes" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'DRAFT',
    "payment_id" UUID,
    "journal_entry_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "posted_by_user_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_debit_notes" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "debit_note_number" VARCHAR(50) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "supplier_invoice_id" UUID,
    "purchase_order_id" UUID,
    "currency_id" UUID NOT NULL,
    "debit_date" DATE NOT NULL,
    "reason" VARCHAR(255),
    "notes" TEXT,
    "subtotal" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "grand_total" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "applied_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "remaining_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "status" "DebitNoteStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "posted_by_user_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "journal_entry_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "supplier_debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_debit_note_lines" (
    "id" UUID NOT NULL,
    "debit_note_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "supplier_invoice_line_id" UUID,
    "description" VARCHAR(255),
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_price" DECIMAL(20,4) NOT NULL,
    "discount_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "tax_rate" DECIMAL(12,4) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "line_total" DECIMAL(20,4) NOT NULL,
    "return_to_inventory" BOOLEAN NOT NULL DEFAULT false,
    "disposition" "ReturnDisposition",
    "location_id" UUID,
    "batch_number" VARCHAR(100),
    "serial_numbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "line_number" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_debit_note_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_debit_applications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "debit_note_id" UUID NOT NULL,
    "supplier_invoice_id" UUID NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "applied_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "supplier_debit_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE UNIQUE INDEX "customer_credit_notes_organization_id_credit_note_number_key" ON "customer_credit_notes"("organization_id", "credit_note_number");
CREATE INDEX "customer_credit_notes_organization_id_customer_id_idx" ON "customer_credit_notes"("organization_id", "customer_id");
CREATE INDEX "customer_credit_notes_organization_id_status_idx" ON "customer_credit_notes"("organization_id", "status");
CREATE INDEX "customer_credit_notes_organization_id_customer_invoice_id_idx" ON "customer_credit_notes"("organization_id", "customer_invoice_id");
CREATE INDEX "customer_credit_notes_organization_id_credit_date_idx" ON "customer_credit_notes"("organization_id", "credit_date");

CREATE INDEX "customer_credit_note_lines_organization_id_credit_note_id_idx" ON "customer_credit_note_lines"("organization_id", "credit_note_id");
CREATE INDEX "customer_credit_note_lines_organization_id_item_id_idx" ON "customer_credit_note_lines"("organization_id", "item_id");
CREATE INDEX "customer_credit_note_lines_organization_id_location_id_idx" ON "customer_credit_note_lines"("organization_id", "location_id");

CREATE INDEX "customer_credit_applications_organization_id_credit_note_id_idx" ON "customer_credit_applications"("organization_id", "credit_note_id");
CREATE INDEX "customer_credit_applications_organization_id_customer_invoi_idx" ON "customer_credit_applications"("organization_id", "customer_invoice_id");

CREATE UNIQUE INDEX "customer_refunds_organization_id_refund_number_key" ON "customer_refunds"("organization_id", "refund_number");
CREATE INDEX "customer_refunds_organization_id_customer_id_idx" ON "customer_refunds"("organization_id", "customer_id");
CREATE INDEX "customer_refunds_organization_id_credit_note_id_idx" ON "customer_refunds"("organization_id", "credit_note_id");
CREATE INDEX "customer_refunds_organization_id_status_idx" ON "customer_refunds"("organization_id", "status");
CREATE INDEX "customer_refunds_organization_id_payment_account_id_idx" ON "customer_refunds"("organization_id", "payment_account_id");

CREATE UNIQUE INDEX "supplier_debit_notes_organization_id_debit_note_number_key" ON "supplier_debit_notes"("organization_id", "debit_note_number");
CREATE INDEX "supplier_debit_notes_organization_id_supplier_id_idx" ON "supplier_debit_notes"("organization_id", "supplier_id");
CREATE INDEX "supplier_debit_notes_organization_id_status_idx" ON "supplier_debit_notes"("organization_id", "status");
CREATE INDEX "supplier_debit_notes_organization_id_supplier_invoice_id_idx" ON "supplier_debit_notes"("organization_id", "supplier_invoice_id");
CREATE INDEX "supplier_debit_notes_organization_id_debit_date_idx" ON "supplier_debit_notes"("organization_id", "debit_date");

CREATE INDEX "supplier_debit_note_lines_organization_id_debit_note_id_idx" ON "supplier_debit_note_lines"("organization_id", "debit_note_id");
CREATE INDEX "supplier_debit_note_lines_organization_id_item_id_idx" ON "supplier_debit_note_lines"("organization_id", "item_id");
CREATE INDEX "supplier_debit_note_lines_organization_id_location_id_idx" ON "supplier_debit_note_lines"("organization_id", "location_id");

CREATE INDEX "supplier_debit_applications_organization_id_debit_note_id_idx" ON "supplier_debit_applications"("organization_id", "debit_note_id");
CREATE INDEX "supplier_debit_applications_organization_id_supplier_invoice_idx" ON "supplier_debit_applications"("organization_id", "supplier_invoice_id");

-- Foreign Keys
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "customer_credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_customer_invoice_line_id_fkey" FOREIGN KEY ("customer_invoice_line_id") REFERENCES "customer_invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "customer_credit_note_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_credit_applications" ADD CONSTRAINT "customer_credit_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_credit_applications" ADD CONSTRAINT "customer_credit_applications_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "customer_credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_credit_applications" ADD CONSTRAINT "customer_credit_applications_customer_invoice_id_fkey" FOREIGN KEY ("customer_invoice_id") REFERENCES "customer_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "customer_credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "customer_refunds" ADD CONSTRAINT "customer_refunds_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "supplier_debit_notes_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "supplier_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_supplier_invoice_line_id_fkey" FOREIGN KEY ("supplier_invoice_line_id") REFERENCES "supplier_invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "supplier_debit_note_lines_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "supplier_debit_applications" ADD CONSTRAINT "supplier_debit_applications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_applications" ADD CONSTRAINT "supplier_debit_applications_debit_note_id_fkey" FOREIGN KEY ("debit_note_id") REFERENCES "supplier_debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "supplier_debit_applications" ADD CONSTRAINT "supplier_debit_applications_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check Constraints
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "chk_customer_credit_notes_amounts" CHECK (
    "subtotal" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "grand_total" >= 0 AND
    "applied_amount" >= 0 AND "remaining_amount" >= 0 AND "applied_amount" <= "grand_total"
);

ALTER TABLE "customer_credit_note_lines" ADD CONSTRAINT "chk_customer_credit_note_line_amounts" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0
);

ALTER TABLE "customer_credit_applications" ADD CONSTRAINT "chk_customer_credit_app_amount" CHECK ("amount" > 0);

ALTER TABLE "customer_refunds" ADD CONSTRAINT "chk_customer_refunds_amount" CHECK ("amount" > 0);

ALTER TABLE "supplier_debit_notes" ADD CONSTRAINT "chk_supplier_debit_notes_amounts" CHECK (
    "subtotal" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "grand_total" >= 0 AND
    "applied_amount" >= 0 AND "remaining_amount" >= 0 AND "applied_amount" <= "grand_total"
);

ALTER TABLE "supplier_debit_note_lines" ADD CONSTRAINT "chk_supplier_debit_note_line_amounts" CHECK (
    "quantity" > 0 AND "unit_price" >= 0 AND "discount_amount" >= 0 AND "tax_amount" >= 0 AND "line_total" >= 0
);

ALTER TABLE "supplier_debit_applications" ADD CONSTRAINT "chk_supplier_debit_app_amount" CHECK ("amount" > 0);
