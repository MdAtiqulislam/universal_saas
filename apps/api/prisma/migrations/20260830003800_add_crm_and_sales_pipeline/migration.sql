-- Milestone M35: CRM, Customer Relationship & Sales Pipeline Foundation

-- Update QuotationStatus Enum
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "QuotationStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

-- Create New CRM Enums
CREATE TYPE "LeadStatus" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'UNQUALIFIED',
  'CONVERTED',
  'LOST',
  'CLOSED'
);

CREATE TYPE "LeadSource" AS ENUM (
  'WEBSITE',
  'REFERRAL',
  'SOCIAL_MEDIA',
  'CAMPAIGN',
  'ADVERTISEMENT',
  'PARTNER',
  'COLD_OUTREACH',
  'EXHIBITION',
  'OTHER'
);

CREATE TYPE "LeadPriority" AS ENUM (
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT'
);

CREATE TYPE "OpportunityStatus" AS ENUM (
  'OPEN',
  'QUALIFIED',
  'PROPOSAL',
  'NEGOTIATION',
  'WON',
  'LOST',
  'CLOSED'
);

CREATE TYPE "OpportunityStage" AS ENUM (
  'PROSPECTING',
  'QUALIFICATION',
  'NEEDS_ANALYSIS',
  'PROPOSAL',
  'NEGOTIATION',
  'CLOSED_WON',
  'CLOSED_LOST'
);

CREATE TYPE "ActivityType" AS ENUM (
  'CALL',
  'EMAIL',
  'MEETING',
  'TASK',
  'NOTE',
  'FOLLOW_UP',
  'DEMO',
  'SITE_VISIT',
  'OTHER'
);

CREATE TYPE "ActivityStatus" AS ENUM (
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'OVERDUE'
);

-- Alter CustomerContact
ALTER TABLE "customer_contacts"
  ADD COLUMN IF NOT EXISTS "mobile" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "department" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "preferred_communication_method" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "customer_contacts_organization_id_is_active_idx" ON "customer_contacts"("organization_id", "is_active");

-- Alter Quotations
ALTER TABLE "quotations"
  ADD COLUMN IF NOT EXISTS "opportunity_id" UUID,
  ADD COLUMN IF NOT EXISTS "contact_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_by_user_id" UUID,
  ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "accepted_by" VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "terms" TEXT,
  ADD COLUMN IF NOT EXISTS "is_immutable" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "quotations_organization_id_opportunity_id_idx" ON "quotations"("organization_id", "opportunity_id");
CREATE INDEX IF NOT EXISTS "quotations_organization_id_contact_id_idx" ON "quotations"("organization_id", "contact_id");

-- Create Lead Table
CREATE TABLE "crm_leads" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "lead_number" VARCHAR(50) NOT NULL,
  "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
  "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
  "priority" "LeadPriority" NOT NULL DEFAULT 'MEDIUM',
  "name" VARCHAR(200) NOT NULL,
  "company_name" VARCHAR(200),
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "mobile" VARCHAR(50),
  "designation" VARCHAR(100),
  "assigned_employee_id" UUID,
  "estimated_value" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "expected_conversion_date" DATE,
  "notes" TEXT,
  "qualification_notes" TEXT,
  "lost_reason" TEXT,
  "converted_customer_id" UUID,
  "converted_opportunity_id" UUID,
  "converted_at" TIMESTAMPTZ(6),
  "converted_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_leads_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_leads_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_leads_converted_customer_id_fkey" FOREIGN KEY ("converted_customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "crm_leads_organization_id_lead_number_key" ON "crm_leads"("organization_id", "lead_number");
CREATE INDEX "crm_leads_organization_id_status_idx" ON "crm_leads"("organization_id", "status");
CREATE INDEX "crm_leads_organization_id_source_idx" ON "crm_leads"("organization_id", "source");
CREATE INDEX "crm_leads_organization_id_priority_idx" ON "crm_leads"("organization_id", "priority");
CREATE INDEX "crm_leads_organization_id_assigned_employee_id_idx" ON "crm_leads"("organization_id", "assigned_employee_id");
CREATE INDEX "crm_leads_organization_id_converted_customer_id_idx" ON "crm_leads"("organization_id", "converted_customer_id");

-- Create Opportunity Table
CREATE TABLE "crm_opportunities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "opportunity_number" VARCHAR(50) NOT NULL,
  "customer_id" UUID NOT NULL,
  "primary_contact_id" UUID,
  "lead_id" UUID,
  "owner_employee_id" UUID,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "status" "OpportunityStatus" NOT NULL DEFAULT 'OPEN',
  "stage" "OpportunityStage" NOT NULL DEFAULT 'PROSPECTING',
  "probability" DECIMAL(5, 2) NOT NULL DEFAULT 10,
  "estimated_value" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "expected_close_date" DATE,
  "source" "LeadSource" NOT NULL DEFAULT 'WEBSITE',
  "currency_id" UUID,
  "lost_reason" TEXT,
  "won_date" TIMESTAMPTZ(6),
  "lost_date" TIMESTAMPTZ(6),
  "closed_date" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_opportunities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_opportunities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_primary_contact_id_fkey" FOREIGN KEY ("primary_contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_owner_employee_id_fkey" FOREIGN KEY ("owner_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunities_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "crm_opportunities_organization_id_opportunity_number_key" ON "crm_opportunities"("organization_id", "opportunity_number");
CREATE INDEX "crm_opportunities_organization_id_customer_id_idx" ON "crm_opportunities"("organization_id", "customer_id");
CREATE INDEX "crm_opportunities_organization_id_status_idx" ON "crm_opportunities"("organization_id", "status");
CREATE INDEX "crm_opportunities_organization_id_stage_idx" ON "crm_opportunities"("organization_id", "stage");
CREATE INDEX "crm_opportunities_organization_id_owner_employee_id_idx" ON "crm_opportunities"("organization_id", "owner_employee_id");
CREATE INDEX "crm_opportunities_organization_id_expected_close_date_idx" ON "crm_opportunities"("organization_id", "expected_close_date");

-- Add foreign key from Lead to Opportunity for converted_opportunity_id
ALTER TABLE "crm_leads"
  ADD CONSTRAINT "crm_leads_converted_opportunity_id_fkey"
  FOREIGN KEY ("converted_opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add foreign keys on Quotations
ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_opportunity_id_fkey"
  FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "quotations_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create OpportunityLine Table
CREATE TABLE "crm_opportunity_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "opportunity_id" UUID NOT NULL,
  "item_id" UUID NOT NULL,
  "variant_id" UUID,
  "description" TEXT,
  "quantity" DECIMAL(18, 4) NOT NULL DEFAULT 1,
  "unit_price" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "discount_amount" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "estimated_amount" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "tax_rate" DECIMAL(12, 4) NOT NULL DEFAULT 0,
  "tax_amount" DECIMAL(18, 4) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_opportunity_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_opportunity_lines_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunity_lines_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunity_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "crm_opportunity_lines_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "item_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "crm_opportunity_lines_organization_id_opportunity_id_idx" ON "crm_opportunity_lines"("organization_id", "opportunity_id");
CREATE INDEX "crm_opportunity_lines_organization_id_item_id_idx" ON "crm_opportunity_lines"("organization_id", "item_id");

-- Create CrmActivity Table
CREATE TABLE "crm_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "type" "ActivityType" NOT NULL DEFAULT 'CALL',
  "subject" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "scheduled_at" TIMESTAMPTZ(6),
  "completed_at" TIMESTAMPTZ(6),
  "status" "ActivityStatus" NOT NULL DEFAULT 'PENDING',
  "assigned_employee_id" UUID,
  "outcome" TEXT,
  "follow_up_date" DATE,
  "lead_id" UUID,
  "opportunity_id" UUID,
  "customer_id" UUID,
  "contact_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "crm_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "crm_activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "crm_activities_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_activities_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "crm_opportunities"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_activities_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "crm_activities_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "crm_activities_organization_id_status_idx" ON "crm_activities"("organization_id", "status");
CREATE INDEX "crm_activities_organization_id_type_idx" ON "crm_activities"("organization_id", "type");
CREATE INDEX "crm_activities_organization_id_assigned_employee_id_idx" ON "crm_activities"("organization_id", "assigned_employee_id");
CREATE INDEX "crm_activities_organization_id_lead_id_idx" ON "crm_activities"("organization_id", "lead_id");
CREATE INDEX "crm_activities_organization_id_opportunity_id_idx" ON "crm_activities"("organization_id", "opportunity_id");
CREATE INDEX "crm_activities_organization_id_customer_id_idx" ON "crm_activities"("organization_id", "customer_id");
