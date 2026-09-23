-- CreateEnum
CREATE TYPE "AssetDepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'DECLINING_BALANCE', 'DOUBLE_DECLINING_BALANCE', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "FixedAssetStatus" AS ENUM ('DRAFT', 'CAPITALIZED', 'ACTIVE', 'FULLY_DEPRECIATED', 'DISPOSED', 'IMPAIRED', 'VOIDED');

-- CreateEnum
CREATE TYPE "AssetDepreciationEntryStatus" AS ENUM ('SCHEDULED', 'POSTED', 'VOIDED');

-- CreateTable
CREATE TABLE "asset_categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "asset_account_id" UUID,
    "accumulated_depreciation_account_id" UUID,
    "depreciation_expense_account_id" UUID,
    "depreciation_method" "AssetDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "default_useful_life_months" INTEGER NOT NULL DEFAULT 60,
    "default_residual_value_percent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "asset_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixed_assets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_number" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category_id" UUID NOT NULL,
    "serial_number" VARCHAR(100),
    "location_id" UUID,
    "supplier_id" UUID,
    "purchase_order_id" UUID,
    "goods_receipt_id" UUID,
    "supplier_invoice_id" UUID,
    "currency_id" UUID NOT NULL,
    "acquisition_date" DATE NOT NULL,
    "placed_in_service_date" DATE,
    "acquisition_cost" DECIMAL(20,4) NOT NULL,
    "residual_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "accumulated_depreciation" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "net_book_value" DECIMAL(20,4) NOT NULL,
    "useful_life_months" INTEGER NOT NULL,
    "depreciation_method" "AssetDepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "status" "FixedAssetStatus" NOT NULL DEFAULT 'DRAFT',
    "asset_account_id" UUID,
    "accumulated_depreciation_account_id" UUID,
    "depreciation_expense_account_id" UUID,
    "capitalized_at" TIMESTAMPTZ(6),
    "capitalized_by_user_id" UUID,
    "capitalization_journal_entry_id" UUID,
    "disposed_at" TIMESTAMPTZ(6),
    "disposed_by_user_id" UUID,
    "disposal_proceeds" DECIMAL(20,4),
    "disposal_gain_loss" DECIMAL(20,4),
    "disposal_journal_entry_id" UUID,
    "disposal_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "fixed_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciation_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "fiscal_period_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "opening_book_value" DECIMAL(20,4) NOT NULL,
    "depreciation_amount" DECIMAL(20,4) NOT NULL,
    "accumulated_depreciation" DECIMAL(20,4) NOT NULL,
    "closing_book_value" DECIMAL(20,4) NOT NULL,
    "status" "AssetDepreciationEntryStatus" NOT NULL DEFAULT 'SCHEDULED',
    "journal_entry_id" UUID,
    "posted_at" TIMESTAMPTZ(6),
    "posted_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "asset_depreciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_transfer_histories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "from_location_id" UUID,
    "to_location_id" UUID NOT NULL,
    "transfer_date" DATE NOT NULL,
    "reason" TEXT,
    "transferred_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_transfer_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "asset_categories_organization_id_code_key" ON "asset_categories"("organization_id", "code");
CREATE INDEX "asset_categories_organization_id_is_active_idx" ON "asset_categories"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "fixed_assets_organization_id_asset_number_key" ON "fixed_assets"("organization_id", "asset_number");
CREATE INDEX "fixed_assets_organization_id_status_idx" ON "fixed_assets"("organization_id", "status");
CREATE INDEX "fixed_assets_organization_id_category_id_idx" ON "fixed_assets"("organization_id", "category_id");
CREATE INDEX "fixed_assets_organization_id_location_id_idx" ON "fixed_assets"("organization_id", "location_id");
CREATE INDEX "fixed_assets_organization_id_acquisition_date_idx" ON "fixed_assets"("organization_id", "acquisition_date");

-- CreateIndex
CREATE UNIQUE INDEX "asset_depreciation_entries_organization_id_asset_id_fiscal_period_id_key" ON "asset_depreciation_entries"("organization_id", "asset_id", "fiscal_period_id");
CREATE INDEX "asset_depreciation_entries_organization_id_status_idx" ON "asset_depreciation_entries"("organization_id", "status");
CREATE INDEX "asset_depreciation_entries_organization_id_fiscal_period_id_idx" ON "asset_depreciation_entries"("organization_id", "fiscal_period_id");

-- CreateIndex
CREATE INDEX "asset_transfer_histories_organization_id_asset_id_idx" ON "asset_transfer_histories"("organization_id", "asset_id");
CREATE INDEX "asset_transfer_histories_organization_id_transfer_date_idx" ON "asset_transfer_histories"("organization_id", "transfer_date");

-- AddForeignKey
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_accumulated_depreciation_account_id_fkey" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_categories" ADD CONSTRAINT "asset_categories_depreciation_expense_account_id_fkey" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "asset_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_supplier_invoice_id_fkey" FOREIGN KEY ("supplier_invoice_id") REFERENCES "supplier_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_asset_account_id_fkey" FOREIGN KEY ("asset_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_accumulated_depreciation_account_id_fkey" FOREIGN KEY ("accumulated_depreciation_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_depreciation_expense_account_id_fkey" FOREIGN KEY ("depreciation_expense_account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_capitalization_journal_entry_id_fkey" FOREIGN KEY ("capitalization_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_disposal_journal_entry_id_fkey" FOREIGN KEY ("disposal_journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciation_entries" ADD CONSTRAINT "asset_depreciation_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_depreciation_entries" ADD CONSTRAINT "asset_depreciation_entries_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_depreciation_entries" ADD CONSTRAINT "asset_depreciation_entries_fiscal_period_id_fkey" FOREIGN KEY ("fiscal_period_id") REFERENCES "fiscal_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "asset_depreciation_entries" ADD CONSTRAINT "asset_depreciation_entries_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfer_histories" ADD CONSTRAINT "asset_transfer_histories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_histories" ADD CONSTRAINT "asset_transfer_histories_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "fixed_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_histories" ADD CONSTRAINT "asset_transfer_histories_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "asset_transfer_histories" ADD CONSTRAINT "asset_transfer_histories_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
