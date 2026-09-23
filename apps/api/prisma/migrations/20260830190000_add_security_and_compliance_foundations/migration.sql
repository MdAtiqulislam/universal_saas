-- Milestone M37: Security, Compliance & Platform Hardening Foundation Migration

-- Alter Table "users"
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "password_changed_at" TIMESTAMPTZ(6);

-- Alter Table "sessions"
ALTER TABLE "sessions"
  ADD COLUMN IF NOT EXISTS "device_info" TEXT,
  ADD COLUMN IF NOT EXISTS "revoked_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "sessions_revoked_at_idx" ON "sessions"("revoked_at");

-- Create Table "login_attempts"
CREATE TABLE IF NOT EXISTS "login_attempts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" VARCHAR(255) NOT NULL,
  "organization_id" UUID,
  "user_id" UUID,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "status" VARCHAR(50) NOT NULL,
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "login_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "login_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "login_attempts_email_created_at_idx" ON "login_attempts"("email", "created_at");
CREATE INDEX IF NOT EXISTS "login_attempts_ip_address_created_at_idx" ON "login_attempts"("ip_address", "created_at");
CREATE INDEX IF NOT EXISTS "login_attempts_organization_id_created_at_idx" ON "login_attempts"("organization_id", "created_at");
CREATE INDEX IF NOT EXISTS "login_attempts_user_id_created_at_idx" ON "login_attempts"("user_id", "created_at");

-- Create Table "security_events"
CREATE TABLE IF NOT EXISTS "security_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "category" VARCHAR(50) NOT NULL,
  "event_type" VARCHAR(100) NOT NULL,
  "severity" VARCHAR(20) NOT NULL DEFAULT 'INFO',
  "actor_user_id" UUID,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "resource" VARCHAR(100),
  "resource_id" VARCHAR(100),
  "details" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "security_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "security_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "security_events_organization_id_category_created_at_idx" ON "security_events"("organization_id", "category", "created_at");
CREATE INDEX IF NOT EXISTS "security_events_organization_id_severity_created_at_idx" ON "security_events"("organization_id", "severity", "created_at");
CREATE INDEX IF NOT EXISTS "security_events_organization_id_event_type_idx" ON "security_events"("organization_id", "event_type");
CREATE INDEX IF NOT EXISTS "security_events_actor_user_id_created_at_idx" ON "security_events"("actor_user_id", "created_at");

-- Create Table "security_policies"
CREATE TABLE IF NOT EXISTS "security_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "max_failed_logins" INTEGER NOT NULL DEFAULT 5,
  "lockout_duration_minutes" INTEGER NOT NULL DEFAULT 15,
  "session_lifetime_hours" INTEGER NOT NULL DEFAULT 24,
  "session_idle_timeout_minutes" INTEGER NOT NULL DEFAULT 60,
  "password_min_length" INTEGER NOT NULL DEFAULT 12,
  "password_require_uppercase" BOOLEAN NOT NULL DEFAULT true,
  "password_require_numbers" BOOLEAN NOT NULL DEFAULT true,
  "password_require_symbols" BOOLEAN NOT NULL DEFAULT true,
  "password_history_retention" INTEGER NOT NULL DEFAULT 5,
  "api_rate_limit_per_minute" INTEGER NOT NULL DEFAULT 120,
  "mfa_enforced" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "security_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "security_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "security_policies_organization_id_key" ON "security_policies"("organization_id");
