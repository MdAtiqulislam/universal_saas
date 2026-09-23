-- Milestone M36: Platform Performance, Scalability & Concurrency Foundation Migration

-- Create Composite Index Additions for Tenant-Scoped Queries
CREATE INDEX IF NOT EXISTS "sales_orders_organization_id_status_created_at_idx" ON "sales_orders"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "customer_invoices_organization_id_status_created_at_idx" ON "customer_invoices"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "payments_organization_id_status_created_at_idx" ON "payments"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "return_requests_organization_id_status_created_at_idx" ON "return_requests"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "crm_leads_organization_id_status_created_at_idx" ON "crm_leads"("organization_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "crm_opportunities_organization_id_status_created_at_idx" ON "crm_opportunities"("organization_id", "status", "created_at");

-- Create Idempotency Records Table
CREATE TABLE IF NOT EXISTS "idempotency_records" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(255) NOT NULL,
  "action" VARCHAR(100) NOT NULL,
  "resource" VARCHAR(100),
  "resource_id" VARCHAR(100),
  "request_hash" VARCHAR(255),
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "status_code" INTEGER,
  "response_body" JSONB,
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_records_organization_id_idempotency_key_key" ON "idempotency_records"("organization_id", "idempotency_key");
CREATE INDEX IF NOT EXISTS "idempotency_records_organization_id_action_idx" ON "idempotency_records"("organization_id", "action");
CREATE INDEX IF NOT EXISTS "idempotency_records_organization_id_status_idx" ON "idempotency_records"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- Create Background Jobs Table
CREATE TABLE IF NOT EXISTS "background_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "job_type" VARCHAR(100) NOT NULL,
  "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "payload" JSONB,
  "result" JSONB,
  "error" TEXT,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "actor_user_id" UUID,
  "started_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "background_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "background_jobs_organization_id_status_idx" ON "background_jobs"("organization_id", "status");
CREATE INDEX IF NOT EXISTS "background_jobs_organization_id_job_type_idx" ON "background_jobs"("organization_id", "job_type");
CREATE INDEX IF NOT EXISTS "background_jobs_organization_id_created_at_idx" ON "background_jobs"("organization_id", "created_at");
