-- CreateEnum
CREATE TYPE "ItemType" AS ENUM ('PRODUCT', 'SERVICE', 'DIGITAL');

-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('NONE', 'BATCH', 'SERIAL');

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "parent_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "symbol" VARCHAR(10),
    "decimal_places" INTEGER NOT NULL DEFAULT 2,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category_id" UUID,
    "unit_id" UUID NOT NULL,
    "item_type" "ItemType" NOT NULL DEFAULT 'PRODUCT',
    "tracking_type" "TrackingType" NOT NULL DEFAULT 'NONE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_variants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200),
    "attributes" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_tiers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "currency_id" UUID NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "pricing_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_prices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "item_id" UUID,
    "variant_id" UUID,
    "pricing_tier_id" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "min_quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "item_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_organization_id_code_key" ON "categories"("organization_id", "code");

-- CreateIndex
CREATE INDEX "categories_organization_id_idx" ON "categories"("organization_id");

-- CreateIndex
CREATE INDEX "categories_organization_id_parent_id_idx" ON "categories"("organization_id", "parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_organization_id_code_key" ON "units_of_measure"("organization_id", "code");

-- CreateIndex
CREATE INDEX "units_of_measure_organization_id_idx" ON "units_of_measure"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_organization_id_sku_key" ON "items"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "items_organization_id_idx" ON "items"("organization_id");

-- CreateIndex
CREATE INDEX "items_organization_id_category_id_idx" ON "items"("organization_id", "category_id");

-- CreateIndex
CREATE INDEX "items_organization_id_is_active_idx" ON "items"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "item_variants_organization_id_sku_key" ON "item_variants"("organization_id", "sku");

-- CreateIndex
CREATE INDEX "item_variants_organization_id_idx" ON "item_variants"("organization_id");

-- CreateIndex
CREATE INDEX "item_variants_organization_id_item_id_idx" ON "item_variants"("organization_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_tiers_organization_id_code_key" ON "pricing_tiers"("organization_id", "code");

-- CreateIndex
CREATE INDEX "pricing_tiers_organization_id_idx" ON "pricing_tiers"("organization_id");

-- CreateIndex: Partial Unique Index for Single Default Pricing Tier per Organization
CREATE UNIQUE INDEX "pricing_tiers_org_default_idx" ON "pricing_tiers"("organization_id") WHERE "is_default" = true AND "is_active" = true;

-- CreateIndex
CREATE INDEX "item_prices_organization_id_idx" ON "item_prices"("organization_id");

-- CreateIndex
CREATE INDEX "item_prices_organization_id_item_id_idx" ON "item_prices"("organization_id", "item_id");

-- CreateIndex
CREATE INDEX "item_prices_organization_id_variant_id_idx" ON "item_prices"("organization_id", "variant_id");

-- CreateIndex
CREATE INDEX "item_prices_organization_id_pricing_tier_id_idx" ON "item_prices"("organization_id", "pricing_tier_id");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units_of_measure" ADD CONSTRAINT "units_of_measure_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_variants" ADD CONSTRAINT "item_variants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_tiers" ADD CONSTRAINT "pricing_tiers_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_pricing_tier_id_fkey" FOREIGN KEY ("pricing_tier_id") REFERENCES "pricing_tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Check Constraints
ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_target_xor" CHECK (
    ("item_id" IS NOT NULL AND "variant_id" IS NULL)
    OR
    ("item_id" IS NULL AND "variant_id" IS NOT NULL)
);

ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_positive_amount" CHECK ("amount" > 0);

ALTER TABLE "item_prices" ADD CONSTRAINT "item_prices_positive_min_qty" CHECK ("min_quantity" > 0);
