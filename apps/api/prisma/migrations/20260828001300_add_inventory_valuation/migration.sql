-- CreateTable: inventory_cost_layers
CREATE TABLE "inventory_cost_layers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "batch_id" UUID,
    "receipt_quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "remaining_quantity" DECIMAL(18,4) NOT NULL,
    "consumed_quantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "source_document" VARCHAR(50) NOT NULL,
    "source_document_id" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_cost_layers_pkey" PRIMARY KEY ("id")
);

-- CreateTable: inventory_valuations
CREATE TABLE "inventory_valuations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "quantity_on_hand" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "average_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_value" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "last_cost" DECIMAL(18,4),
    "last_calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable: cost_of_goods_sold_records
CREATE TABLE "cost_of_goods_sold_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "location_id" UUID NOT NULL,
    "stock_movement_id" UUID,
    "delivery_order_id" UUID,
    "journal_entry_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_cost" DECIMAL(18,4) NOT NULL,
    "total_cost" DECIMAL(20,4) NOT NULL,
    "source_document" VARCHAR(50) NOT NULL,
    "source_document_id" VARCHAR(100),
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_of_goods_sold_records_pkey" PRIMARY KEY ("id")
);

-- Indexes for inventory_cost_layers
CREATE INDEX "inventory_cost_layers_organization_id_item_id_location_id_idx" ON "inventory_cost_layers"("organization_id", "item_id", "location_id");
CREATE INDEX "inventory_cost_layers_organization_id_remaining_quantity_idx" ON "inventory_cost_layers"("organization_id", "remaining_quantity");
CREATE INDEX "inventory_cost_layers_organization_id_created_at_idx" ON "inventory_cost_layers"("organization_id", "created_at");
CREATE INDEX "inventory_cost_layers_organization_id_source_document_source__idx" ON "inventory_cost_layers"("organization_id", "source_document", "source_document_id");

-- Indexes for inventory_valuations
CREATE INDEX "inventory_valuations_organization_id_item_id_location_id_idx" ON "inventory_valuations"("organization_id", "item_id", "location_id");
CREATE INDEX "inventory_valuations_organization_id_item_id_variant_id_locat_idx" ON "inventory_valuations"("organization_id", "item_id", "variant_id", "location_id");

-- Indexes for cost_of_goods_sold_records
CREATE INDEX "cost_of_goods_sold_records_organization_id_item_id_idx" ON "cost_of_goods_sold_records"("organization_id", "item_id");
CREATE INDEX "cost_of_goods_sold_records_organization_id_location_id_idx" ON "cost_of_goods_sold_records"("organization_id", "location_id");
CREATE INDEX "cost_of_goods_sold_records_organization_id_recorded_at_idx" ON "cost_of_goods_sold_records"("organization_id", "recorded_at");
CREATE INDEX "cost_of_goods_sold_records_organization_id_source_document_so_idx" ON "cost_of_goods_sold_records"("organization_id", "source_document", "source_document_id");

-- Foreign keys for inventory_cost_layers
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_cost_layers" ADD CONSTRAINT "inventory_cost_layers_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "inventory_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign keys for inventory_valuations
ALTER TABLE "inventory_valuations" ADD CONSTRAINT "inventory_valuations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inventory_valuations" ADD CONSTRAINT "inventory_valuations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_valuations" ADD CONSTRAINT "inventory_valuations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_valuations" ADD CONSTRAINT "inventory_valuations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for cost_of_goods_sold_records
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_stock_movement_id_fkey" FOREIGN KEY ("stock_movement_id") REFERENCES "stock_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cost_of_goods_sold_records" ADD CONSTRAINT "cost_of_goods_sold_records_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
