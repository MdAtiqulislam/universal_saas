-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('DRAFT', 'READY', 'ASSIGNED', 'DISPATCHED', 'IN_TRANSIT', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CarrierType" AS ENUM ('COURIER', 'TRANSPORT_COMPANY', 'FREIGHT_FORWARDER', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ShipmentTrackingEventType" AS ENUM ('CREATED', 'READY', 'ASSIGNED', 'DISPATCHED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_ATTEMPT_FAILED', 'RETURN_INITIATED', 'RETURNED', 'CANCELLED');

-- CreateTable
CREATE TABLE "shipment_carriers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "carrier_type" "CarrierType" NOT NULL DEFAULT 'COURIER',
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "tracking_url_template" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipment_carriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_vehicles" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "carrier_id" UUID,
    "registration_number" VARCHAR(100) NOT NULL,
    "vehicle_type" VARCHAR(50) NOT NULL,
    "driver_name" TEXT,
    "driver_phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipment_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shipment_number" VARCHAR(50) NOT NULL,
    "delivery_order_id" UUID NOT NULL,
    "sales_order_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "carrier_id" UUID,
    "vehicle_id" UUID,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'DRAFT',
    "service_type" VARCHAR(50),
    "ship_from_address" TEXT,
    "ship_to_address" TEXT,
    "planned_ship_date" TIMESTAMPTZ(6),
    "actual_ship_date" TIMESTAMPTZ(6),
    "estimated_delivery_date" TIMESTAMPTZ(6),
    "actual_delivery_date" TIMESTAMPTZ(6),
    "tracking_number" VARCHAR(100),
    "external_reference" VARCHAR(100),
    "shipping_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "insurance_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "other_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "total_logistics_cost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "special_instructions" TEXT,
    "failure_reason" TEXT,
    "return_reason" TEXT,
    "cancellation_reason" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID,
    "dispatched_by_user_id" UUID,
    "dispatched_at" TIMESTAMPTZ(6),
    "delivered_by_user_id" UUID,
    "delivered_at" TIMESTAMPTZ(6),
    "cancelled_by_user_id" UUID,
    "cancelled_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "delivery_order_line_id" UUID NOT NULL,
    "sales_order_line_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "variant_id" UUID,
    "package_id" UUID,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unit_of_measure" VARCHAR(20),
    "package_reference" TEXT,
    "batch_reference" TEXT,
    "serial_reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_packages" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_number" VARCHAR(50) NOT NULL,
    "package_type" VARCHAR(50),
    "weight" DECIMAL(12,4),
    "weight_unit" VARCHAR(20),
    "length" DECIMAL(12,4),
    "width" DECIMAL(12,4),
    "height" DECIMAL(12,4),
    "dimension_unit" VARCHAR(20),
    "tracking_number" VARCHAR(100),
    "status" VARCHAR(50),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "shipment_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_tracking_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "status" "ShipmentStatus" NOT NULL,
    "event_type" "ShipmentTrackingEventType" NOT NULL,
    "event_time" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "description" TEXT,
    "source" VARCHAR(50),
    "external_reference" TEXT,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipment_carriers_organization_id_code_key" ON "shipment_carriers"("organization_id", "code");
CREATE INDEX "shipment_carriers_organization_id_is_active_idx" ON "shipment_carriers"("organization_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_vehicles_organization_id_registration_number_key" ON "shipment_vehicles"("organization_id", "registration_number");
CREATE INDEX "shipment_vehicles_organization_id_carrier_id_idx" ON "shipment_vehicles"("organization_id", "carrier_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_organization_id_shipment_number_key" ON "shipments"("organization_id", "shipment_number");
CREATE INDEX "shipments_organization_id_status_idx" ON "shipments"("organization_id", "status");
CREATE INDEX "shipments_organization_id_customer_id_idx" ON "shipments"("organization_id", "customer_id");
CREATE INDEX "shipments_organization_id_delivery_order_id_idx" ON "shipments"("organization_id", "delivery_order_id");
CREATE INDEX "shipments_organization_id_carrier_id_idx" ON "shipments"("organization_id", "carrier_id");
CREATE INDEX "shipments_organization_id_tracking_number_idx" ON "shipments"("organization_id", "tracking_number");
CREATE INDEX "shipments_organization_id_planned_ship_date_idx" ON "shipments"("organization_id", "planned_ship_date");
CREATE INDEX "shipments_organization_id_estimated_delivery_date_idx" ON "shipments"("organization_id", "estimated_delivery_date");

-- CreateIndex
CREATE INDEX "shipment_lines_organization_id_shipment_id_idx" ON "shipment_lines"("organization_id", "shipment_id");
CREATE INDEX "shipment_lines_organization_id_delivery_order_line_id_idx" ON "shipment_lines"("organization_id", "delivery_order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipment_packages_organization_id_shipment_id_package_number_key" ON "shipment_packages"("organization_id", "shipment_id", "package_number");
CREATE INDEX "shipment_packages_organization_id_shipment_id_idx" ON "shipment_packages"("organization_id", "shipment_id");

-- CreateIndex
CREATE INDEX "shipment_tracking_events_organization_id_shipment_id_event_time_idx" ON "shipment_tracking_events"("organization_id", "shipment_id", "event_time");

-- AddForeignKey
ALTER TABLE "shipment_carriers" ADD CONSTRAINT "shipment_carriers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_vehicles" ADD CONSTRAINT "shipment_vehicles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_vehicles" ADD CONSTRAINT "shipment_vehicles_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "shipment_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_delivery_order_id_fkey" FOREIGN KEY ("delivery_order_id") REFERENCES "delivery_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "sales_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_carrier_id_fkey" FOREIGN KEY ("carrier_id") REFERENCES "shipment_carriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "shipment_vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_delivery_order_line_id_fkey" FOREIGN KEY ("delivery_order_line_id") REFERENCES "delivery_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_sales_order_line_id_fkey" FOREIGN KEY ("sales_order_line_id") REFERENCES "sales_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "shipment_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_packages" ADD CONSTRAINT "shipment_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipment_tracking_events" ADD CONSTRAINT "shipment_tracking_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
