/*
  Warnings:

  - You are about to drop the column `updated_at` on the `pricing_tiers` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `pricing_tiers` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "IncidentSeverity" AS ENUM ('SEV1', 'SEV2', 'SEV3', 'SEV4');

-- CreateEnum
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'MITIGATED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "IncidentSource" AS ENUM ('ALERT', 'MANUAL', 'AUTOMATED', 'EXTERNAL');

-- CreateEnum
CREATE TYPE "AlertRuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AlertEventStatus" AS ENUM ('NORMAL', 'TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- CreateEnum
CREATE TYPE "SloStatus" AS ENUM ('HEALTHY', 'AT_RISK', 'BREACHED');

-- CreateEnum
CREATE TYPE "SloScope" AS ENUM ('PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "OperationalErrorSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "OperationalErrorCategory" AS ENUM ('VALIDATION', 'AUTHENTICATION', 'AUTHORIZATION', 'TENANT', 'NOT_FOUND', 'CONFLICT', 'BUSINESS_RULE', 'CONCURRENCY', 'DATABASE', 'EXTERNAL_SERVICE', 'BACKGROUND_JOB', 'SECURITY', 'INTERNAL');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('UP', 'DEGRADED', 'DOWN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MetricScope" AS ENUM ('PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "GovernanceClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "GovernanceDeletionStrategy" AS ENUM ('HARD_DELETE', 'ANONYMIZE_PII', 'IMMUTABLE_FINANCIAL_RETAIN');

-- CreateEnum
CREATE TYPE "GovernanceResidencyTier" AS ENUM ('STANDARD', 'SENSITIVE', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "GovernanceTransferPolicy" AS ENUM ('ALLOWED', 'RESTRICTED', 'PROHIBITED');

-- CreateEnum
CREATE TYPE "RetentionAnchor" AS ENUM ('RECORD_CREATED_AT', 'RECORD_UPDATED_AT', 'DOMAIN_EVENT_AT', 'EXPIRES_AT');

-- CreateEnum
CREATE TYPE "LegalHoldStatus" AS ENUM ('ACTIVE', 'RELEASED');

-- CreateEnum
CREATE TYPE "LegalHoldTargetType" AS ENUM ('ORGANIZATION', 'DATASET', 'RECORD', 'SUBJECT');

-- CreateEnum
CREATE TYPE "DsarRequestType" AS ENUM ('ACCESS', 'EXPORT', 'ERASURE');

-- CreateEnum
CREATE TYPE "DsarRequestStatus" AS ENUM ('SUBMITTED', 'PENDING_VERIFICATION', 'PENDING_REVIEW', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED_BY_HOLD');

-- CreateEnum
CREATE TYPE "DsarBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'BLOCKED_BY_HOLD');

-- CreateEnum
CREATE TYPE "IntegrationProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED');

-- CreateEnum
CREATE TYPE "IntegrationConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'PENDING');

-- CreateEnum
CREATE TYPE "IntegrationCredentialType" AS ENUM ('API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'OAUTH2', 'WEBHOOK_SECRET');

-- CreateEnum
CREATE TYPE "WebhookSubscriptionStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FAILED');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'SUCCESS', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "InboundWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'FAILED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "WorkflowNodeType" AS ENUM ('START', 'END', 'CONDITION', 'ACTION', 'APPROVAL', 'PARALLEL', 'JOIN', 'DELAY', 'SCHEDULE', 'SUB_WORKFLOW');

-- CreateEnum
CREATE TYPE "WorkflowTriggerType" AS ENUM ('EVENT', 'SCHEDULE', 'MANUAL', 'API');

-- CreateEnum
CREATE TYPE "WorkflowExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "WorkflowStepStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'ESCALATED');

-- CreateEnum
CREATE TYPE "WorkflowApprovalType" AS ENUM ('ANY_ONE', 'ALL', 'MINIMUM_COUNT', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "WorkflowApproverType" AS ENUM ('USER', 'ROLE', 'MANAGER', 'OWNER');

-- CreateEnum
CREATE TYPE "WorkflowScheduleType" AS ENUM ('CRON', 'INTERVAL', 'ONE_TIME');

-- CreateEnum
CREATE TYPE "WorkflowScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "WorkflowJoinStrategy" AS ENUM ('ALL', 'ANY', 'QUORUM');

-- CreateEnum
CREATE TYPE "BillingPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingPricingModel" AS ENUM ('FLAT', 'PER_UNIT', 'TIERED', 'VOLUME', 'USAGE_BASED', 'HYBRID', 'CUSTOM');

-- CreateEnum
CREATE TYPE "BillingSubscriptionStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'PAUSED', 'CANCELLED', 'EXPIRED', 'INCOMPLETE', 'INCOMPLETE_EXPIRED');

-- CreateEnum
CREATE TYPE "BillingQuotaType" AS ENUM ('HARD_LIMIT', 'SOFT_LIMIT', 'UNLIMITED');

-- CreateEnum
CREATE TYPE "BillingInvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'PARTIALLY_PAID', 'VOID', 'UNCOLLECTIBLE');

-- CreateEnum
CREATE TYPE "BillingPaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BillingCreditType" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "BillingDiscountDuration" AS ENUM ('ONCE', 'RECURRING', 'FOREVER');

-- CreateEnum
CREATE TYPE "BillingWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'DUPLICATE', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationTemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "NotificationScheduleStatus" AS ENUM ('PENDING', 'EXECUTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ANDROID', 'IOS', 'WEB');

-- CreateEnum
CREATE TYPE "CommunicationProviderType" AS ENUM ('IN_APP', 'EMAIL', 'PUSH', 'SMS');

-- CreateEnum
CREATE TYPE "SearchScope" AS ENUM ('GLOBAL', 'CRM', 'SALES', 'INVENTORY', 'WAREHOUSE', 'QUALITY', 'RETURNS', 'SERVICE', 'FINANCE', 'WORKFLOW', 'NOTIFICATIONS', 'DEVELOPER', 'BILLING', 'ADMIN');

-- CreateEnum
CREATE TYPE "SavedViewVisibility" AS ENUM ('PERSONAL', 'SHARED', 'TENANT');

-- CreateEnum
CREATE TYPE "SavedViewShareType" AS ENUM ('USER', 'ROLE', 'TEAM', 'TENANT');

-- CreateEnum
CREATE TYPE "SearchAlertTriggerType" AS ENUM ('NEW_MATCH', 'STATUS_CHANGE', 'THRESHOLD_CROSSED');

-- CreateEnum
CREATE TYPE "SearchAlertStatus" AS ENUM ('ACTIVE', 'PAUSED', 'TRIGGERED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION', 'PUBLIC');

-- CreateEnum
CREATE TYPE "ReportShareType" AS ENUM ('USER', 'ROLE', 'TEAM');

-- CreateEnum
CREATE TYPE "ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ReportExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DashboardVisibility" AS ENUM ('PRIVATE', 'ORGANIZATION', 'PUBLIC');

-- CreateEnum
CREATE TYPE "DashboardWidgetType" AS ENUM ('METRIC_CARD', 'CHART_LINE', 'CHART_BAR', 'CHART_PIE', 'TABLE', 'KPI_SUMMARY');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "DataOperationType" AS ENUM ('EXPORT', 'IMPORT');

-- CreateEnum
CREATE TYPE "DataOperationStatus" AS ENUM ('PENDING', 'PREVIEWING', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PARTIALLY_COMPLETED');

-- CreateEnum
CREATE TYPE "DataImportMode" AS ENUM ('CREATE_ONLY', 'UPDATE_ONLY', 'UPSERT');

-- CreateEnum
CREATE TYPE "DataDuplicateStrategy" AS ENUM ('FAIL', 'SKIP', 'UPDATE');

-- AlterTable
ALTER TABLE "accounting_account_mappings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "background_jobs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_account_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_reconciliations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_statement_transactions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "bank_statements" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "capas" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cost_of_goods_sold_records" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_activities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_leads" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_opportunities" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "crm_opportunity_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_addresses" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_asset_warranties" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_assets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_contacts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_credit_note_lines" ALTER COLUMN "serial_numbers" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_groups" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_invoice_lines" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_prices" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customer_quality_issues" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "delivery_order_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "delivery_orders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "effective_tax_rates" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_categories" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_claim_lines" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_claimants" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_claims" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "expense_receipts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "financial_report_snapshots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "fiscal_periods" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "idempotency_records" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inspection_characteristics" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inspection_plans" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inspection_results" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_cost_layers" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_reservations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_valuations" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "journal_entries" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "login_attempts" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "non_conformances" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_accounts" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payment_allocations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "period_close_checks" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "period_close_runs" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "pricing_tiers" DROP COLUMN "updated_at",
ADD COLUMN     "updatedAt" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "quality_configurations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quality_holds" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quality_inspection_lots" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotation_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "quotations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_order_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales_orders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sampling_plans" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "security_events" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "security_policies" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_assignments" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_configurations" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_diagnoses" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_estimate_lines" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_estimates" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_handovers" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_labor_entries" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_orders" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_part_requirements" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_requests" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "service_tickets" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "supplier_debit_note_lines" ALTER COLUMN "serial_numbers" DROP DEFAULT;

-- AlterTable
ALTER TABLE "supplier_invoice_lines" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "supplier_invoices" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_codes" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_jurisdictions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_periods" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_rules" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "tax_transactions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "warranty_policies" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "operational_incidents" (
    "id" UUID NOT NULL,
    "incident_number" TEXT NOT NULL,
    "organization_id" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "severity" "IncidentSeverity" NOT NULL,
    "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
    "source" "IncidentSource" NOT NULL DEFAULT 'MANUAL',
    "detected_at" TIMESTAMPTZ(6) NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "owner_user_id" UUID,
    "root_cause" TEXT,
    "resolution" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_alert_rules" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric_key" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "window_seconds" INTEGER NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "status" "AlertRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "cooldown_seconds" INTEGER NOT NULL DEFAULT 300,
    "destination_meta" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_alert_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_alert_events" (
    "id" UUID NOT NULL,
    "alert_rule_id" UUID NOT NULL,
    "organization_id" UUID,
    "status" "AlertEventStatus" NOT NULL DEFAULT 'TRIGGERED',
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "resolved_at" TIMESTAMPTZ(6),
    "triggered_value" DOUBLE PRECISION NOT NULL,
    "incident_id" UUID,
    "context" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operational_alert_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_level_objectives" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metric_key" TEXT NOT NULL,
    "scope" "SloScope" NOT NULL,
    "target_value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'percent',
    "window_days" INTEGER NOT NULL DEFAULT 30,
    "current_value" DOUBLE PRECISION,
    "status" "SloStatus" NOT NULL DEFAULT 'HEALTHY',
    "breach_count" INTEGER NOT NULL DEFAULT 0,
    "last_evaluated_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_level_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_errors" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "request_id" TEXT,
    "correlation_id" TEXT,
    "error_code" TEXT NOT NULL,
    "category" "OperationalErrorCategory" NOT NULL,
    "severity" "OperationalErrorSeverity" NOT NULL,
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "stack_hash" TEXT,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "resolved_at" TIMESTAMPTZ(6),
    "resolution_note" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_providers" (
    "id" UUID NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "category" VARCHAR(100) NOT NULL,
    "status" "IntegrationProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "config_schema" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "IntegrationConnectionStatus" NOT NULL DEFAULT 'PENDING',
    "config_data" JSONB,
    "last_health_check" TIMESTAMPTZ(6),
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "integration_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "credential_type" "IntegrationCredentialType" NOT NULL,
    "encrypted_value" TEXT NOT NULL,
    "iv" VARCHAR(64) NOT NULL,
    "auth_tag" VARCHAR(64) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "key_prefix" VARCHAR(8) NOT NULL,
    "sha256_hash" VARCHAR(64) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMPTZ(6),
    "last_used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "endpoint" TEXT NOT NULL,
    "signing_secret" TEXT NOT NULL,
    "subscribed_events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "WebhookSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "retry_policy" JSONB,
    "timeout_seconds" INTEGER NOT NULL DEFAULT 30,
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "last_delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "payload" JSONB NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integration_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "integration_event_id" UUID NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "next_retry_at" TIMESTAMPTZ(6),
    "last_attempt_at" TIMESTAMPTZ(6),
    "last_http_status" INTEGER,
    "last_response_body" TEXT,
    "last_error_message" TEXT,
    "duration_ms" INTEGER,
    "delivered_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_webhook_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "status" "InboundWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "processing_error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "inbound_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_definitions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    "status" "WorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version_id" UUID,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_versions" (
    "id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "checksum" VARCHAR(64),
    "definition_snapshot" JSONB,
    "published_at" TIMESTAMPTZ(6),
    "published_by_user_id" UUID,
    "retired_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_nodes" (
    "id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "node_key" VARCHAR(100) NOT NULL,
    "node_type" "WorkflowNodeType" NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_edges" (
    "id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "condition_rule_id" UUID,
    "condition_expression" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_triggers" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "event_type" VARCHAR(150),
    "filter_expression" JSONB,
    "config" JSONB,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_triggers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" UUID NOT NULL,
    "workflow_version_id" UUID,
    "node_id" UUID,
    "name" VARCHAR(200) NOT NULL,
    "ast" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_actions" (
    "id" UUID NOT NULL,
    "workflow_version_id" UUID,
    "node_id" UUID,
    "action_type" VARCHAR(100) NOT NULL,
    "parameters" JSONB NOT NULL,
    "retry_policy" JSONB,
    "timeout_seconds" INTEGER NOT NULL DEFAULT 60,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "workflow_version_id" UUID NOT NULL,
    "trigger_type" "WorkflowTriggerType" NOT NULL,
    "trigger_event_id" TEXT,
    "status" "WorkflowExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "current_node_id" UUID,
    "correlation_id" VARCHAR(100),
    "causation_id" VARCHAR(100),
    "idempotency_key" VARCHAR(255),
    "input_context" JSONB,
    "output_context" JSONB,
    "variables" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_steps" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "idempotency_key" VARCHAR(255),
    "input" JSONB,
    "output" JSONB,
    "error_code" VARCHAR(100),
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approvals" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "node_id" UUID NOT NULL,
    "approval_type" "WorkflowApprovalType" NOT NULL DEFAULT 'ANY_ONE',
    "approver_type" "WorkflowApproverType" NOT NULL DEFAULT 'ROLE',
    "approver_target" VARCHAR(200) NOT NULL,
    "minimum_approvals" INTEGER NOT NULL DEFAULT 1,
    "status" "WorkflowApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMPTZ(6),
    "escalate_at" TIMESTAMPTZ(6),
    "escalated_to" VARCHAR(200),
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_approval_actions" (
    "id" UUID NOT NULL,
    "approval_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "decision" "WorkflowApprovalStatus" NOT NULL,
    "reason" TEXT,
    "delegated_from_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_approval_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workflow_definition_id" UUID NOT NULL,
    "schedule_type" "WorkflowScheduleType" NOT NULL,
    "cron_expression" VARCHAR(100),
    "interval_seconds" INTEGER,
    "timezone" VARCHAR(100) NOT NULL DEFAULT 'UTC',
    "status" "WorkflowScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "next_run_at" TIMESTAMPTZ(6),
    "last_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "level" VARCHAR(20) NOT NULL,
    "event" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_compensations" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "step_id" UUID,
    "action_type" VARCHAR(100) NOT NULL,
    "status" "WorkflowStepStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "executed_at" TIMESTAMPTZ(6),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_compensations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "api_key_id" UUID,
    "request_id" VARCHAR(128) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "route" VARCHAR(500) NOT NULL,
    "status_code" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "response_class" VARCHAR(10) NOT NULL,
    "user_agent" VARCHAR(500),
    "client_ip_hash" VARCHAR(64),
    "api_version" VARCHAR(20) NOT NULL DEFAULT 'v1',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plans" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "BillingPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plan_versions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "name" VARCHAR(200) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "checksum" VARCHAR(64),
    "effective_from" TIMESTAMPTZ(6),
    "effective_until" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_plan_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_prices" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "pricing_model" "BillingPricingModel" NOT NULL DEFAULT 'FLAT',
    "unit_amount" INTEGER NOT NULL DEFAULT 0,
    "tiers" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_features" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "value_type" VARCHAR(50) NOT NULL DEFAULT 'BOOLEAN',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_plan_features" (
    "id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "feature_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "numeric_limit" INTEGER,
    "is_unlimited" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "billing_plan_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscriptions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "plan_version_id" UUID NOT NULL,
    "price_id" UUID,
    "status" "BillingSubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "scope" VARCHAR(50) NOT NULL DEFAULT 'PLATFORM',
    "current_period_start" TIMESTAMPTZ(6) NOT NULL,
    "current_period_end" TIMESTAMPTZ(6) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMPTZ(6),
    "ended_at" TIMESTAMPTZ(6),
    "trial_start" TIMESTAMPTZ(6),
    "trial_end" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "provider_subscription_id" VARCHAR(200),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_subscription_items" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "item_key" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ(6) NOT NULL,
    "period_end" TIMESTAMPTZ(6) NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_usage_metrics" (
    "id" UUID NOT NULL,
    "metric_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "unit" VARCHAR(50) NOT NULL DEFAULT 'count',
    "aggregation_type" VARCHAR(50) NOT NULL DEFAULT 'SUM',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_usage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_usage_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_key" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "source" VARCHAR(100) NOT NULL DEFAULT 'api',
    "source_id" VARCHAR(200),
    "idempotency_key" VARCHAR(200),
    "timestamp" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "billing_usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_usage_aggregates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "period_id" UUID,
    "metric_key" VARCHAR(100) NOT NULL,
    "total_quantity" INTEGER NOT NULL DEFAULT 0,
    "date" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_usage_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_quotas" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "metric_key" VARCHAR(100) NOT NULL,
    "quota_type" "BillingQuotaType" NOT NULL DEFAULT 'HARD_LIMIT',
    "allocated_amount" INTEGER NOT NULL DEFAULT 0,
    "authorized_override" INTEGER,
    "override_reason" TEXT,
    "current_usage" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subscription_id" UUID,
    "period_id" UUID,
    "invoice_number" VARCHAR(100) NOT NULL,
    "status" "BillingInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "tax_amount" INTEGER NOT NULL DEFAULT 0,
    "credit_applied" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "amount_due" INTEGER NOT NULL DEFAULT 0,
    "issue_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" TIMESTAMPTZ(6) NOT NULL,
    "finalized_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "voided_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_invoice_line_items" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "item_type" VARCHAR(50) NOT NULL DEFAULT 'BASE_SUBSCRIPTION',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_amount" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "billing_invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_credits" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "reason" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6),
    "consumed_amount" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_discounts" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "discount_type" "BillingCreditType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" INTEGER NOT NULL DEFAULT 0,
    "duration" "BillingDiscountDuration" NOT NULL DEFAULT 'ONCE',
    "valid_until" TIMESTAMPTZ(6),
    "max_redemptions" INTEGER,
    "times_redeemed" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_payments" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "status" "BillingPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider_key" VARCHAR(100) NOT NULL DEFAULT 'sandbox',
    "provider_transaction_id" VARCHAR(200),
    "failure_reason" TEXT,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" UUID NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL,
    "provider_event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" "BillingWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "signature" VARCHAR(255),
    "error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "key" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "status" "NotificationTemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "active_version_id" UUID,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_template_versions" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "locale" VARCHAR(20) NOT NULL DEFAULT 'en',
    "subject" VARCHAR(255),
    "body" TEXT NOT NULL,
    "variables" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "snapshot_hash" VARCHAR(64) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_id" UUID,
    "template_version_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "payload" JSONB,
    "idempotency_key" VARCHAR(200),
    "scheduled_at" TIMESTAMPTZ(6),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "user_id" UUID,
    "destination" VARCHAR(255),
    "read_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "notification_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL DEFAULT 'in_app',
    "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "next_retry_at" TIMESTAMPTZ(6),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_delivery_attempts" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "provider_message_id" VARCHAR(200),
    "failure_code" VARCHAR(100),
    "failure_category" VARCHAR(50),
    "response_summary" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "event_category" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quiet_hours_start" VARCHAR(10),
    "quiet_hours_end" VARCHAR(10),
    "timezone" VARCHAR(50) DEFAULT 'UTC',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_per_minute" INTEGER,
    "require_security_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "communication_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_provider_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "provider_key" VARCHAR(100) NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "encrypted_credentials" TEXT,
    "credential_iv" VARCHAR(64),
    "credential_auth_tag" VARCHAR(64),
    "credential_fingerprint" VARCHAR(64),
    "priority" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "communication_provider_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_devices" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "device_token" VARCHAR(255) NOT NULL,
    "app_version" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_seen_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "push_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "template_key" VARCHAR(100) NOT NULL,
    "channels" "NotificationChannel"[] DEFAULT ARRAY['IN_APP']::"NotificationChannel"[],
    "recipient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "payload" JSONB,
    "send_at" TIMESTAMPTZ(6) NOT NULL,
    "timezone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "status" "NotificationScheduleStatus" NOT NULL DEFAULT 'PENDING',
    "execution_id" VARCHAR(128),
    "executed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_webhook_events" (
    "id" UUID NOT NULL,
    "provider_key" VARCHAR(100) NOT NULL,
    "provider_event_id" VARCHAR(200) NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "signature" VARCHAR(255),
    "error" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_definitions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "scope" "SearchScope" NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "table_name" VARCHAR(100) NOT NULL,
    "searchable_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filterable_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "default_sort_field" VARCHAR(100) NOT NULL DEFAULT 'createdAt',
    "required_permission" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(50),
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_histories" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "query_text" VARCHAR(255) NOT NULL,
    "scope" "SearchScope" NOT NULL DEFAULT 'GLOBAL',
    "filters" JSONB,
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recent_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "scope" "SearchScope" NOT NULL DEFAULT 'GLOBAL',
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "url" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "accessed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "favorite_items" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(100) NOT NULL,
    "scope" "SearchScope" NOT NULL DEFAULT 'GLOBAL',
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(255),
    "url" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_views" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "resource_type" VARCHAR(100) NOT NULL,
    "scope" "SearchScope" NOT NULL DEFAULT 'GLOBAL',
    "visibility" "SavedViewVisibility" NOT NULL DEFAULT 'PERSONAL',
    "filters" JSONB,
    "sorting" JSONB,
    "selected_columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "search_text" VARCHAR(255),
    "pagination_defaults" JSONB,
    "display_config" JSONB,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_view_shares" (
    "id" UUID NOT NULL,
    "saved_view_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "share_type" "SavedViewShareType" NOT NULL,
    "target_id" VARCHAR(100) NOT NULL,
    "permission" VARCHAR(20) NOT NULL DEFAULT 'VIEW',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_view_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_alerts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "saved_view_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "trigger_type" "SearchAlertTriggerType" NOT NULL DEFAULT 'NEW_MATCH',
    "schedule_cron" VARCHAR(50),
    "alert_interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "last_evaluated_at" TIMESTAMPTZ(6),
    "last_triggered_at" TIMESTAMPTZ(6),
    "status" "SearchAlertStatus" NOT NULL DEFAULT 'ACTIVE',
    "failure_count" INTEGER NOT NULL DEFAULT 0,
    "notify_channels" TEXT[] DEFAULT ARRAY['IN_APP']::TEXT[],
    "channel_config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "search_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_alert_executions" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "execution_id" VARCHAR(128) NOT NULL,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "status" "SearchAlertStatus" NOT NULL DEFAULT 'TRIGGERED',
    "delivered_channel_count" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "error_message" TEXT,
    "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_alert_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_analytics_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "query_hash" VARCHAR(64) NOT NULL,
    "scope" "SearchScope" NOT NULL DEFAULT 'GLOBAL',
    "resource_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "result_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "zero_results" BOOLEAN NOT NULL DEFAULT false,
    "selected_resource_id" VARCHAR(100),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_definitions" (
    "id" UUID NOT NULL,
    "definition_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "domain" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "allowed_dimensions" JSONB NOT NULL,
    "allowed_measures" JSONB NOT NULL,
    "supported_aggregations" TEXT[] DEFAULT ARRAY['COUNT', 'SUM', 'AVG', 'MIN', 'MAX']::TEXT[],
    "allowed_filter_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "required_permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "analytics_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "definition_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "dimensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "measures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filter_ast" JSONB,
    "time_dimension" VARCHAR(100),
    "time_granularity" VARCHAR(50),
    "time_zone" VARCHAR(50) NOT NULL DEFAULT 'UTC',
    "limit" INTEGER NOT NULL DEFAULT 50,
    "offset" INTEGER NOT NULL DEFAULT 0,
    "sort_by" VARCHAR(100),
    "sort_direction" VARCHAR(10) NOT NULL DEFAULT 'asc',
    "visibility" "ReportVisibility" NOT NULL DEFAULT 'PRIVATE',
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "owner_user_id" UUID NOT NULL,
    "last_executed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_shares" (
    "id" UUID NOT NULL,
    "saved_report_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "share_type" "ReportShareType" NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "saved_report_id" UUID,
    "executed_by_user_id" UUID,
    "execution_id" VARCHAR(128) NOT NULL,
    "status" "ReportExecutionStatus" NOT NULL DEFAULT 'RUNNING',
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "snapshot_data" JSONB,
    "executed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "saved_report_id" UUID NOT NULL,
    "frequency" "ReportScheduleFrequency" NOT NULL,
    "cron_expression" VARCHAR(100),
    "recipients" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "channels" TEXT[] DEFAULT ARRAY['IN_APP']::TEXT[],
    "export_format" "ExportFormat" NOT NULL DEFAULT 'CSV',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ(6),
    "next_run_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "layout" JSONB,
    "visibility" "DashboardVisibility" NOT NULL DEFAULT 'PRIVATE',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "owner_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_shares" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "share_type" "ReportShareType" NOT NULL,
    "target_id" VARCHAR(128) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dashboard_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "saved_report_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "widget_type" "DashboardWidgetType" NOT NULL,
    "position" JSONB NOT NULL,
    "config" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_usage_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "event_type" VARCHAR(100) NOT NULL,
    "resource_type" VARCHAR(100) NOT NULL,
    "resource_id" VARCHAR(128),
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "row_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_operation_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_key" VARCHAR(100) NOT NULL,
    "operation_type" "DataOperationType" NOT NULL,
    "status" "DataOperationStatus" NOT NULL DEFAULT 'PENDING',
    "format" "ExportFormat" NOT NULL DEFAULT 'CSV',
    "mode" "DataImportMode",
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "successful_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "file_key" VARCHAR(500),
    "file_size" INTEGER,
    "file_name" VARCHAR(255),
    "file_mime" VARCHAR(100),
    "idempotency_key" VARCHAR(128),
    "parameters" JSONB,
    "metadata" JSONB,
    "error_summary" TEXT,
    "result_summary" JSONB,
    "completed_batches" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_operation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_operation_batches" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "batch_index" INTEGER NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    "start_row" INTEGER NOT NULL,
    "end_row" INTEGER NOT NULL,
    "row_count" INTEGER NOT NULL,
    "successful_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "data_operation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_operation_errors" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "field_name" VARCHAR(100),
    "error_code" VARCHAR(100) NOT NULL,
    "error_message" TEXT NOT NULL,
    "raw_values" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_operation_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_operation_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "operation_key" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "field_mappings" JSONB,
    "default_parameters" JSONB,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_operation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_datasets" (
    "id" UUID NOT NULL,
    "dataset_key" VARCHAR(150) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "model_name" VARCHAR(150),
    "classification" "GovernanceClassification" NOT NULL DEFAULT 'INTERNAL',
    "deletionStrategy" "GovernanceDeletionStrategy" NOT NULL,
    "retention_applicable" BOOLEAN NOT NULL DEFAULT true,
    "contains_pii" BOOLEAN NOT NULL DEFAULT false,
    "contains_sensitive_data" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "governance_datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_residency_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "jurisdiction_code" VARCHAR(100) NOT NULL,
    "residency_tier" "GovernanceResidencyTier" NOT NULL DEFAULT 'STANDARD',
    "transfer_policy" "GovernanceTransferPolicy" NOT NULL DEFAULT 'RESTRICTED',
    "transfer_configuration" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_marker" VARCHAR(20),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_residency_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_retention_policies" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "retention_duration_days" INTEGER NOT NULL,
    "anchor" "RetentionAnchor" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_marker" VARCHAR(20),
    "superseded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_holds" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dataset_id" UUID,
    "target_type" "LegalHoldTargetType" NOT NULL,
    "target_id" VARCHAR(255),
    "coverage" JSONB NOT NULL DEFAULT '{}',
    "status" "LegalHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "reason" TEXT NOT NULL,
    "reference" VARCHAR(255),
    "created_by_user_id" UUID,
    "released_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "released_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "legal_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "request_type" "DsarRequestType" NOT NULL,
    "status" "DsarRequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "subject_user_id" UUID,
    "subject_reference" VARCHAR(255),
    "requester_user_id" UUID NOT NULL,
    "verification_data" JSONB,
    "verified_at" TIMESTAMPTZ(6),
    "verified_by_user_id" UUID,
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by_user_id" UUID,
    "approved_at" TIMESTAMPTZ(6),
    "approved_by_user_id" UUID,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "request_metadata" JSONB,
    "failure_code" VARCHAR(100),
    "failure_message" TEXT,
    "blocked_by_hold_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "dsar_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dsar_execution_batches" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "dsar_request_id" UUID NOT NULL,
    "dataset_id" UUID,
    "batch_sequence" INTEGER NOT NULL,
    "status" "DsarBatchStatus" NOT NULL DEFAULT 'PENDING',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "processed_items" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "cursor" JSONB,
    "failure_code" VARCHAR(100),
    "failure_message" TEXT,
    "started_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "dsar_execution_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_incidents_incident_number_key" ON "operational_incidents"("incident_number");

-- CreateIndex
CREATE INDEX "operational_incidents_organization_id_status_detected_at_idx" ON "operational_incidents"("organization_id", "status", "detected_at");

-- CreateIndex
CREATE INDEX "operational_incidents_status_severity_detected_at_idx" ON "operational_incidents"("status", "severity", "detected_at");

-- CreateIndex
CREATE INDEX "operational_incidents_owner_user_id_idx" ON "operational_incidents"("owner_user_id");

-- CreateIndex
CREATE INDEX "operational_alert_rules_organization_id_status_idx" ON "operational_alert_rules"("organization_id", "status");

-- CreateIndex
CREATE INDEX "operational_alert_rules_metric_key_status_idx" ON "operational_alert_rules"("metric_key", "status");

-- CreateIndex
CREATE INDEX "operational_alert_events_alert_rule_id_status_triggered_at_idx" ON "operational_alert_events"("alert_rule_id", "status", "triggered_at");

-- CreateIndex
CREATE INDEX "operational_alert_events_organization_id_status_idx" ON "operational_alert_events"("organization_id", "status");

-- CreateIndex
CREATE INDEX "operational_alert_events_incident_id_idx" ON "operational_alert_events"("incident_id");

-- CreateIndex
CREATE INDEX "service_level_objectives_organization_id_scope_is_active_idx" ON "service_level_objectives"("organization_id", "scope", "is_active");

-- CreateIndex
CREATE INDEX "service_level_objectives_metric_key_scope_idx" ON "service_level_objectives"("metric_key", "scope");

-- CreateIndex
CREATE INDEX "operational_errors_organization_id_category_occurred_at_idx" ON "operational_errors"("organization_id", "category", "occurred_at");

-- CreateIndex
CREATE INDEX "operational_errors_stack_hash_occurred_at_idx" ON "operational_errors"("stack_hash", "occurred_at");

-- CreateIndex
CREATE INDEX "operational_errors_module_error_code_occurred_at_idx" ON "operational_errors"("module", "error_code", "occurred_at");

-- CreateIndex
CREATE INDEX "operational_errors_severity_occurred_at_idx" ON "operational_errors"("severity", "occurred_at");

-- CreateIndex
CREATE INDEX "integration_providers_status_category_idx" ON "integration_providers"("status", "category");

-- CreateIndex
CREATE UNIQUE INDEX "integration_providers_provider_key_key" ON "integration_providers"("provider_key");

-- CreateIndex
CREATE INDEX "integration_connections_organization_id_status_idx" ON "integration_connections"("organization_id", "status");

-- CreateIndex
CREATE INDEX "integration_connections_provider_id_idx" ON "integration_connections"("provider_id");

-- CreateIndex
CREATE UNIQUE INDEX "integration_connections_organization_id_name_key" ON "integration_connections"("organization_id", "name");

-- CreateIndex
CREATE INDEX "integration_credentials_connection_id_credential_type_idx" ON "integration_credentials"("connection_id", "credential_type");

-- CreateIndex
CREATE INDEX "api_keys_sha256_hash_idx" ON "api_keys"("sha256_hash");

-- CreateIndex
CREATE INDEX "api_keys_organization_id_revoked_at_idx" ON "api_keys"("organization_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_organization_id_key_prefix_key" ON "api_keys"("organization_id", "key_prefix");

-- CreateIndex
CREATE INDEX "webhook_subscriptions_organization_id_status_idx" ON "webhook_subscriptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "integration_events_organization_id_event_type_occurred_at_idx" ON "integration_events"("organization_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "integration_events_occurred_at_idx" ON "integration_events"("occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "integration_events_organization_id_event_id_key" ON "integration_events"("organization_id", "event_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_organization_id_status_next_retry_at_idx" ON "webhook_deliveries"("organization_id", "status", "next_retry_at");

-- CreateIndex
CREATE INDEX "webhook_deliveries_subscription_id_status_idx" ON "webhook_deliveries"("subscription_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_deliveries_subscription_id_integration_event_id_key" ON "webhook_deliveries"("subscription_id", "integration_event_id");

-- CreateIndex
CREATE INDEX "inbound_webhook_events_organization_id_status_received_at_idx" ON "inbound_webhook_events"("organization_id", "status", "received_at");

-- CreateIndex
CREATE INDEX "inbound_webhook_events_connection_id_event_type_idx" ON "inbound_webhook_events"("connection_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_webhook_events_connection_id_provider_event_id_key" ON "inbound_webhook_events"("connection_id", "provider_event_id");

-- CreateIndex
CREATE INDEX "workflow_definitions_organization_id_status_idx" ON "workflow_definitions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_definitions_organization_id_key_key" ON "workflow_definitions"("organization_id", "key");

-- CreateIndex
CREATE INDEX "workflow_versions_status_idx" ON "workflow_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_versions_workflow_definition_id_version_key" ON "workflow_versions"("workflow_definition_id", "version");

-- CreateIndex
CREATE INDEX "workflow_nodes_workflow_version_id_node_type_idx" ON "workflow_nodes"("workflow_version_id", "node_type");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_nodes_workflow_version_id_node_key_key" ON "workflow_nodes"("workflow_version_id", "node_key");

-- CreateIndex
CREATE INDEX "workflow_edges_workflow_version_id_source_node_id_idx" ON "workflow_edges"("workflow_version_id", "source_node_id");

-- CreateIndex
CREATE INDEX "workflow_edges_target_node_id_idx" ON "workflow_edges"("target_node_id");

-- CreateIndex
CREATE INDEX "workflow_triggers_organization_id_trigger_type_event_type_idx" ON "workflow_triggers"("organization_id", "trigger_type", "event_type");

-- CreateIndex
CREATE INDEX "workflow_triggers_workflow_definition_id_idx" ON "workflow_triggers"("workflow_definition_id");

-- CreateIndex
CREATE INDEX "workflow_executions_organization_id_status_created_at_idx" ON "workflow_executions"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "workflow_executions_workflow_definition_id_workflow_version_idx" ON "workflow_executions"("workflow_definition_id", "workflow_version_id");

-- CreateIndex
CREATE INDEX "workflow_executions_correlation_id_idx" ON "workflow_executions"("correlation_id");

-- CreateIndex
CREATE INDEX "workflow_execution_steps_execution_id_status_idx" ON "workflow_execution_steps"("execution_id", "status");

-- CreateIndex
CREATE INDEX "workflow_execution_steps_node_id_idx" ON "workflow_execution_steps"("node_id");

-- CreateIndex
CREATE INDEX "workflow_approvals_organization_id_status_expires_at_idx" ON "workflow_approvals"("organization_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "workflow_approvals_execution_id_idx" ON "workflow_approvals"("execution_id");

-- CreateIndex
CREATE INDEX "workflow_approval_actions_actor_user_id_idx" ON "workflow_approval_actions"("actor_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_approval_actions_approval_id_actor_user_id_key" ON "workflow_approval_actions"("approval_id", "actor_user_id");

-- CreateIndex
CREATE INDEX "workflow_schedules_organization_id_status_next_run_at_idx" ON "workflow_schedules"("organization_id", "status", "next_run_at");

-- CreateIndex
CREATE INDEX "workflow_schedules_workflow_definition_id_idx" ON "workflow_schedules"("workflow_definition_id");

-- CreateIndex
CREATE INDEX "workflow_execution_logs_execution_id_timestamp_idx" ON "workflow_execution_logs"("execution_id", "timestamp");

-- CreateIndex
CREATE INDEX "workflow_compensations_execution_id_idx" ON "workflow_compensations"("execution_id");

-- CreateIndex
CREATE INDEX "api_usage_records_organization_id_created_at_idx" ON "api_usage_records"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "api_usage_records_organization_id_api_key_id_created_at_idx" ON "api_usage_records"("organization_id", "api_key_id", "created_at");

-- CreateIndex
CREATE INDEX "api_usage_records_organization_id_route_created_at_idx" ON "api_usage_records"("organization_id", "route", "created_at");

-- CreateIndex
CREATE INDEX "api_usage_records_organization_id_status_code_created_at_idx" ON "api_usage_records"("organization_id", "status_code", "created_at");

-- CreateIndex
CREATE INDEX "api_usage_records_request_id_idx" ON "api_usage_records"("request_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_plans_key_key" ON "billing_plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_plan_versions_plan_id_version_key" ON "billing_plan_versions"("plan_id", "version");

-- CreateIndex
CREATE INDEX "billing_prices_plan_version_id_idx" ON "billing_prices"("plan_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_features_key_key" ON "billing_features"("key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_plan_features_plan_version_id_feature_id_key" ON "billing_plan_features"("plan_version_id", "feature_id");

-- CreateIndex
CREATE INDEX "billing_subscriptions_organization_id_status_idx" ON "billing_subscriptions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "billing_subscriptions_status_current_period_end_idx" ON "billing_subscriptions"("status", "current_period_end");

-- CreateIndex
CREATE INDEX "billing_subscription_items_subscription_id_idx" ON "billing_subscription_items"("subscription_id");

-- CreateIndex
CREATE INDEX "billing_periods_subscription_id_period_start_period_end_idx" ON "billing_periods"("subscription_id", "period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_metrics_metric_key_key" ON "billing_usage_metrics"("metric_key");

-- CreateIndex
CREATE INDEX "billing_usage_records_organization_id_metric_key_timestamp_idx" ON "billing_usage_records"("organization_id", "metric_key", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_records_organization_id_idempotency_key_key" ON "billing_usage_records"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "billing_usage_aggregates_organization_id_date_idx" ON "billing_usage_aggregates"("organization_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_usage_aggregates_organization_id_metric_key_date_key" ON "billing_usage_aggregates"("organization_id", "metric_key", "date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_quotas_organization_id_metric_key_key" ON "billing_quotas"("organization_id", "metric_key");

-- CreateIndex
CREATE UNIQUE INDEX "billing_invoices_invoice_number_key" ON "billing_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "billing_invoices_organization_id_status_idx" ON "billing_invoices"("organization_id", "status");

-- CreateIndex
CREATE INDEX "billing_invoices_organization_id_issue_date_idx" ON "billing_invoices"("organization_id", "issue_date");

-- CreateIndex
CREATE INDEX "billing_invoice_line_items_invoice_id_idx" ON "billing_invoice_line_items"("invoice_id");

-- CreateIndex
CREATE INDEX "billing_credits_organization_id_idx" ON "billing_credits"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_discounts_code_key" ON "billing_discounts"("code");

-- CreateIndex
CREATE INDEX "billing_payments_organization_id_invoice_id_idx" ON "billing_payments"("organization_id", "invoice_id");

-- CreateIndex
CREATE INDEX "billing_payments_provider_transaction_id_idx" ON "billing_payments"("provider_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "billing_webhook_events_provider_key_provider_event_id_key" ON "billing_webhook_events"("provider_key", "provider_event_id");

-- CreateIndex
CREATE INDEX "notification_templates_organization_id_channel_status_idx" ON "notification_templates"("organization_id", "channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_organization_id_key_key" ON "notification_templates"("organization_id", "key");

-- CreateIndex
CREATE INDEX "notification_template_versions_template_id_is_published_idx" ON "notification_template_versions"("template_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "notification_template_versions_template_id_version_locale_key" ON "notification_template_versions"("template_id", "version", "locale");

-- CreateIndex
CREATE INDEX "notifications_organization_id_status_created_at_idx" ON "notifications"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "notifications_organization_id_event_type_idx" ON "notifications"("organization_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_organization_id_idempotency_key_key" ON "notifications"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "notification_recipients_organization_id_user_id_read_at_idx" ON "notification_recipients"("organization_id", "user_id", "read_at");

-- CreateIndex
CREATE INDEX "notification_recipients_notification_id_idx" ON "notification_recipients"("notification_id");

-- CreateIndex
CREATE INDEX "notification_deliveries_organization_id_status_next_retry_a_idx" ON "notification_deliveries"("organization_id", "status", "next_retry_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_notification_id_recipient_id_idx" ON "notification_deliveries"("notification_id", "recipient_id");

-- CreateIndex
CREATE INDEX "notification_delivery_attempts_delivery_id_idx" ON "notification_delivery_attempts"("delivery_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_delivery_attempts_delivery_id_attempt_number_key" ON "notification_delivery_attempts"("delivery_id", "attempt_number");

-- CreateIndex
CREATE INDEX "notification_preferences_organization_id_user_id_idx" ON "notification_preferences"("organization_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_organization_id_user_id_event_cate_key" ON "notification_preferences"("organization_id", "user_id", "event_category", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "communication_policies_organization_id_channel_key" ON "communication_policies"("organization_id", "channel");

-- CreateIndex
CREATE INDEX "communication_provider_configs_channel_is_enabled_priority_idx" ON "communication_provider_configs"("channel", "is_enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "communication_provider_configs_organization_id_channel_prov_key" ON "communication_provider_configs"("organization_id", "channel", "provider_key");

-- CreateIndex
CREATE INDEX "push_devices_organization_id_user_id_is_active_idx" ON "push_devices"("organization_id", "user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "push_devices_user_id_device_token_key" ON "push_devices"("user_id", "device_token");

-- CreateIndex
CREATE UNIQUE INDEX "notification_schedules_execution_id_key" ON "notification_schedules"("execution_id");

-- CreateIndex
CREATE INDEX "notification_schedules_organization_id_status_send_at_idx" ON "notification_schedules"("organization_id", "status", "send_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_webhook_events_provider_key_provider_event_id_key" ON "notification_webhook_events"("provider_key", "provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_definitions_key_key" ON "search_definitions"("key");

-- CreateIndex
CREATE INDEX "search_definitions_scope_is_enabled_idx" ON "search_definitions"("scope", "is_enabled");

-- CreateIndex
CREATE INDEX "search_histories_organization_id_user_id_executed_at_idx" ON "search_histories"("organization_id", "user_id", "executed_at");

-- CreateIndex
CREATE INDEX "recent_items_organization_id_user_id_accessed_at_idx" ON "recent_items"("organization_id", "user_id", "accessed_at");

-- CreateIndex
CREATE UNIQUE INDEX "recent_items_organization_id_user_id_resource_type_resource_key" ON "recent_items"("organization_id", "user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "favorite_items_organization_id_user_id_created_at_idx" ON "favorite_items"("organization_id", "user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_items_organization_id_user_id_resource_type_resour_key" ON "favorite_items"("organization_id", "user_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_resource_type_visibility_idx" ON "saved_views"("organization_id", "resource_type", "visibility");

-- CreateIndex
CREATE INDEX "saved_views_organization_id_owner_user_id_idx" ON "saved_views"("organization_id", "owner_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_views_organization_id_owner_user_id_name_key" ON "saved_views"("organization_id", "owner_user_id", "name");

-- CreateIndex
CREATE INDEX "saved_view_shares_organization_id_share_type_target_id_idx" ON "saved_view_shares"("organization_id", "share_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "saved_view_shares_saved_view_id_share_type_target_id_key" ON "saved_view_shares"("saved_view_id", "share_type", "target_id");

-- CreateIndex
CREATE INDEX "search_alerts_organization_id_status_last_evaluated_at_idx" ON "search_alerts"("organization_id", "status", "last_evaluated_at");

-- CreateIndex
CREATE INDEX "search_alert_executions_organization_id_execution_id_idx" ON "search_alert_executions"("organization_id", "execution_id");

-- CreateIndex
CREATE INDEX "search_alert_executions_alert_id_executed_at_idx" ON "search_alert_executions"("alert_id", "executed_at");

-- CreateIndex
CREATE UNIQUE INDEX "search_alert_executions_alert_id_execution_id_key" ON "search_alert_executions"("alert_id", "execution_id");

-- CreateIndex
CREATE INDEX "search_analytics_events_organization_id_scope_occurred_at_idx" ON "search_analytics_events"("organization_id", "scope", "occurred_at");

-- CreateIndex
CREATE INDEX "search_analytics_events_organization_id_zero_results_occurr_idx" ON "search_analytics_events"("organization_id", "zero_results", "occurred_at");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_definitions_definition_key_key" ON "analytics_definitions"("definition_key");

-- CreateIndex
CREATE INDEX "analytics_definitions_domain_is_active_idx" ON "analytics_definitions"("domain", "is_active");

-- CreateIndex
CREATE INDEX "saved_reports_organization_id_visibility_idx" ON "saved_reports"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "saved_reports_organization_id_owner_user_id_idx" ON "saved_reports"("organization_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "saved_reports_organization_id_definition_key_idx" ON "saved_reports"("organization_id", "definition_key");

-- CreateIndex
CREATE INDEX "report_shares_organization_id_share_type_target_id_idx" ON "report_shares"("organization_id", "share_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_shares_saved_report_id_share_type_target_id_key" ON "report_shares"("saved_report_id", "share_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_executions_execution_id_key" ON "report_executions"("execution_id");

-- CreateIndex
CREATE INDEX "report_executions_organization_id_executed_at_idx" ON "report_executions"("organization_id", "executed_at");

-- CreateIndex
CREATE INDEX "report_executions_organization_id_status_idx" ON "report_executions"("organization_id", "status");

-- CreateIndex
CREATE INDEX "report_executions_saved_report_id_executed_at_idx" ON "report_executions"("saved_report_id", "executed_at");

-- CreateIndex
CREATE INDEX "report_schedules_organization_id_is_active_next_run_at_idx" ON "report_schedules"("organization_id", "is_active", "next_run_at");

-- CreateIndex
CREATE INDEX "dashboards_organization_id_visibility_idx" ON "dashboards"("organization_id", "visibility");

-- CreateIndex
CREATE INDEX "dashboards_organization_id_owner_user_id_idx" ON "dashboards"("organization_id", "owner_user_id");

-- CreateIndex
CREATE INDEX "dashboard_shares_organization_id_share_type_target_id_idx" ON "dashboard_shares"("organization_id", "share_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "dashboard_shares_dashboard_id_share_type_target_id_key" ON "dashboard_shares"("dashboard_id", "share_type", "target_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_dashboard_id_idx" ON "dashboard_widgets"("dashboard_id");

-- CreateIndex
CREATE INDEX "dashboard_widgets_organization_id_idx" ON "dashboard_widgets"("organization_id");

-- CreateIndex
CREATE INDEX "analytics_usage_events_organization_id_event_type_occurred__idx" ON "analytics_usage_events"("organization_id", "event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_usage_events_organization_id_occurred_at_idx" ON "analytics_usage_events"("organization_id", "occurred_at");

-- CreateIndex
CREATE INDEX "data_operation_jobs_organization_id_status_idx" ON "data_operation_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "data_operation_jobs_organization_id_operation_type_created__idx" ON "data_operation_jobs"("organization_id", "operation_type", "created_at");

-- CreateIndex
CREATE INDEX "data_operation_jobs_organization_id_idempotency_key_idx" ON "data_operation_jobs"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "data_operation_batches_organization_id_job_id_idx" ON "data_operation_batches"("organization_id", "job_id");

-- CreateIndex
CREATE UNIQUE INDEX "data_operation_batches_job_id_batch_index_key" ON "data_operation_batches"("job_id", "batch_index");

-- CreateIndex
CREATE INDEX "data_operation_errors_job_id_row_number_idx" ON "data_operation_errors"("job_id", "row_number");

-- CreateIndex
CREATE INDEX "data_operation_errors_organization_id_job_id_idx" ON "data_operation_errors"("organization_id", "job_id");

-- CreateIndex
CREATE INDEX "data_operation_templates_organization_id_operation_key_idx" ON "data_operation_templates"("organization_id", "operation_key");

-- CreateIndex
CREATE UNIQUE INDEX "governance_datasets_dataset_key_key" ON "governance_datasets"("dataset_key");

-- CreateIndex
CREATE INDEX "governance_datasets_is_active_classification_idx" ON "governance_datasets"("is_active", "classification");

-- CreateIndex
CREATE INDEX "data_residency_policies_organization_id_dataset_id_effectiv_idx" ON "data_residency_policies"("organization_id", "dataset_id", "effective_at");

-- CreateIndex
CREATE INDEX "data_residency_policies_jurisdiction_code_residency_tier_idx" ON "data_residency_policies"("jurisdiction_code", "residency_tier");

-- CreateIndex
CREATE UNIQUE INDEX "data_residency_policies_organization_id_dataset_id_version_key" ON "data_residency_policies"("organization_id", "dataset_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "data_residency_policies_organization_id_dataset_id_effectiv_key" ON "data_residency_policies"("organization_id", "dataset_id", "effective_marker");

-- CreateIndex
CREATE INDEX "data_retention_policies_organization_id_dataset_id_enabled__idx" ON "data_retention_policies"("organization_id", "dataset_id", "enabled", "effective_at");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_organization_id_dataset_id_version_key" ON "data_retention_policies"("organization_id", "dataset_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "data_retention_policies_organization_id_dataset_id_effectiv_key" ON "data_retention_policies"("organization_id", "dataset_id", "effective_marker");

-- CreateIndex
CREATE INDEX "legal_holds_organization_id_status_target_type_idx" ON "legal_holds"("organization_id", "status", "target_type");

-- CreateIndex
CREATE INDEX "legal_holds_organization_id_dataset_id_status_idx" ON "legal_holds"("organization_id", "dataset_id", "status");

-- CreateIndex
CREATE INDEX "legal_holds_organization_id_target_id_idx" ON "legal_holds"("organization_id", "target_id");

-- CreateIndex
CREATE INDEX "dsar_requests_organization_id_status_created_at_idx" ON "dsar_requests"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "dsar_requests_organization_id_request_type_status_idx" ON "dsar_requests"("organization_id", "request_type", "status");

-- CreateIndex
CREATE INDEX "dsar_requests_organization_id_subject_user_id_idx" ON "dsar_requests"("organization_id", "subject_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_requests_organization_id_idempotency_key_key" ON "dsar_requests"("organization_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "dsar_execution_batches_organization_id_status_created_at_idx" ON "dsar_execution_batches"("organization_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "dsar_execution_batches_dsar_request_id_status_idx" ON "dsar_execution_batches"("dsar_request_id", "status");

-- CreateIndex
CREATE INDEX "dsar_execution_batches_organization_id_dataset_id_idx" ON "dsar_execution_batches"("organization_id", "dataset_id");

-- CreateIndex
CREATE UNIQUE INDEX "dsar_execution_batches_dsar_request_id_batch_sequence_key" ON "dsar_execution_batches"("dsar_request_id", "batch_sequence");

-- RenameForeignKey
ALTER TABLE "service_configurations" RENAME CONSTRAINT "service_configurations_default_service_parts_expense_account_id" TO "service_configurations_default_service_parts_expense_accou_fkey";

-- AddForeignKey
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_incidents" ADD CONSTRAINT "operational_incidents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_rules" ADD CONSTRAINT "operational_alert_rules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_events" ADD CONSTRAINT "operational_alert_events_alert_rule_id_fkey" FOREIGN KEY ("alert_rule_id") REFERENCES "operational_alert_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_events" ADD CONSTRAINT "operational_alert_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_alert_events" ADD CONSTRAINT "operational_alert_events_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "operational_incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_level_objectives" ADD CONSTRAINT "service_level_objectives_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_errors" ADD CONSTRAINT "operational_errors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "integration_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_credentials" ADD CONSTRAINT "integration_credentials_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_events" ADD CONSTRAINT "integration_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_integration_event_id_fkey" FOREIGN KEY ("integration_event_id") REFERENCES "integration_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_webhook_events" ADD CONSTRAINT "inbound_webhook_events_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "integration_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_definitions" ADD CONSTRAINT "workflow_definitions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_versions" ADD CONSTRAINT "workflow_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_nodes" ADD CONSTRAINT "workflow_nodes_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_edges" ADD CONSTRAINT "workflow_edges_condition_rule_id_fkey" FOREIGN KEY ("condition_rule_id") REFERENCES "workflow_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_triggers" ADD CONSTRAINT "workflow_triggers_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_actions" ADD CONSTRAINT "workflow_actions_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_workflow_version_id_fkey" FOREIGN KEY ("workflow_version_id") REFERENCES "workflow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_steps" ADD CONSTRAINT "workflow_execution_steps_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approvals" ADD CONSTRAINT "workflow_approvals_node_id_fkey" FOREIGN KEY ("node_id") REFERENCES "workflow_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approval_actions" ADD CONSTRAINT "workflow_approval_actions_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "workflow_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approval_actions" ADD CONSTRAINT "workflow_approval_actions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_approval_actions" ADD CONSTRAINT "workflow_approval_actions_delegated_from_user_id_fkey" FOREIGN KEY ("delegated_from_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_schedules" ADD CONSTRAINT "workflow_schedules_workflow_definition_id_fkey" FOREIGN KEY ("workflow_definition_id") REFERENCES "workflow_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_compensations" ADD CONSTRAINT "workflow_compensations_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_usage_records" ADD CONSTRAINT "api_usage_records_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_plan_versions" ADD CONSTRAINT "billing_plan_versions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "billing_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_prices" ADD CONSTRAINT "billing_prices_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "billing_plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_plan_features" ADD CONSTRAINT "billing_plan_features_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "billing_plan_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_plan_features" ADD CONSTRAINT "billing_plan_features_feature_id_fkey" FOREIGN KEY ("feature_id") REFERENCES "billing_features"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_version_id_fkey" FOREIGN KEY ("plan_version_id") REFERENCES "billing_plan_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_price_id_fkey" FOREIGN KEY ("price_id") REFERENCES "billing_prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_subscription_items" ADD CONSTRAINT "billing_subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_periods" ADD CONSTRAINT "billing_periods_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_records" ADD CONSTRAINT "billing_usage_records_metric_key_fkey" FOREIGN KEY ("metric_key") REFERENCES "billing_usage_metrics"("metric_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_aggregates" ADD CONSTRAINT "billing_usage_aggregates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_aggregates" ADD CONSTRAINT "billing_usage_aggregates_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_usage_aggregates" ADD CONSTRAINT "billing_usage_aggregates_metric_key_fkey" FOREIGN KEY ("metric_key") REFERENCES "billing_usage_metrics"("metric_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_quotas" ADD CONSTRAINT "billing_quotas_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_quotas" ADD CONSTRAINT "billing_quotas_metric_key_fkey" FOREIGN KEY ("metric_key") REFERENCES "billing_usage_metrics"("metric_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "billing_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "billing_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_invoice_line_items" ADD CONSTRAINT "billing_invoice_line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_credits" ADD CONSTRAINT "billing_credits_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_discounts" ADD CONSTRAINT "billing_discounts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "billing_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_templates" ADD CONSTRAINT "notification_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_template_versions" ADD CONSTRAINT "notification_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "notification_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "notification_template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_recipients" ADD CONSTRAINT "notification_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "notification_recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_delivery_attempts" ADD CONSTRAINT "notification_delivery_attempts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_policies" ADD CONSTRAINT "communication_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_provider_configs" ADD CONSTRAINT "communication_provider_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_devices" ADD CONSTRAINT "push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_schedules" ADD CONSTRAINT "notification_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_histories" ADD CONSTRAINT "search_histories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_items" ADD CONSTRAINT "recent_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_items" ADD CONSTRAINT "recent_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "favorite_items" ADD CONSTRAINT "favorite_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_shares" ADD CONSTRAINT "saved_view_shares_saved_view_id_fkey" FOREIGN KEY ("saved_view_id") REFERENCES "saved_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_view_shares" ADD CONSTRAINT "saved_view_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alerts" ADD CONSTRAINT "search_alerts_saved_view_id_fkey" FOREIGN KEY ("saved_view_id") REFERENCES "saved_views"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alert_executions" ADD CONSTRAINT "search_alert_executions_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "search_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_alert_executions" ADD CONSTRAINT "search_alert_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_analytics_events" ADD CONSTRAINT "search_analytics_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_definition_key_fkey" FOREIGN KEY ("definition_key") REFERENCES "analytics_definitions"("definition_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_shares" ADD CONSTRAINT "report_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_executions" ADD CONSTRAINT "report_executions_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_shares" ADD CONSTRAINT "dashboard_shares_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_saved_report_id_fkey" FOREIGN KEY ("saved_report_id") REFERENCES "saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_usage_events" ADD CONSTRAINT "analytics_usage_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_jobs" ADD CONSTRAINT "data_operation_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_jobs" ADD CONSTRAINT "data_operation_jobs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_batches" ADD CONSTRAINT "data_operation_batches_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_operation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_batches" ADD CONSTRAINT "data_operation_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_errors" ADD CONSTRAINT "data_operation_errors_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "data_operation_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_errors" ADD CONSTRAINT "data_operation_errors_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_operation_templates" ADD CONSTRAINT "data_operation_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_residency_policies" ADD CONSTRAINT "data_residency_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_residency_policies" ADD CONSTRAINT "data_residency_policies_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_retention_policies" ADD CONSTRAINT "data_retention_policies_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legal_holds" ADD CONSTRAINT "legal_holds_released_by_user_id_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_verified_by_user_id_fkey" FOREIGN KEY ("verified_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_blocked_by_hold_id_fkey" FOREIGN KEY ("blocked_by_hold_id") REFERENCES "legal_holds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_execution_batches" ADD CONSTRAINT "dsar_execution_batches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_execution_batches" ADD CONSTRAINT "dsar_execution_batches_dsar_request_id_fkey" FOREIGN KEY ("dsar_request_id") REFERENCES "dsar_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dsar_execution_batches" ADD CONSTRAINT "dsar_execution_batches_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "governance_datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "asset_depreciation_entries_organization_id_asset_id_fiscal_peri" RENAME TO "asset_depreciation_entries_organization_id_asset_id_fiscal__key";

-- RenameIndex
ALTER INDEX "bank_statement_transactions_organization_id_bank_statement_idx" RENAME TO "bank_statement_transactions_organization_id_bank_statement__idx";

-- RenameIndex
ALTER INDEX "capas_org_capa_number_key" RENAME TO "capas_organization_id_capa_number_key";

-- RenameIndex
ALTER INDEX "capas_org_ncr_idx" RENAME TO "capas_organization_id_non_conformance_id_idx";

-- RenameIndex
ALTER INDEX "capas_org_status_idx" RENAME TO "capas_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "cost_of_goods_sold_records_organization_id_source_document_so_i" RENAME TO "cost_of_goods_sold_records_organization_id_source_document__idx";

-- RenameIndex
ALTER INDEX "customer_asset_warranties_organization_id_warranty_policy_id_id" RENAME TO "customer_asset_warranties_organization_id_warranty_policy_i_idx";

-- RenameIndex
ALTER INDEX "customer_quality_issues_org_customer_idx" RENAME TO "customer_quality_issues_organization_id_customer_id_idx";

-- RenameIndex
ALTER INDEX "customer_quality_issues_org_issue_number_key" RENAME TO "customer_quality_issues_organization_id_issue_number_key";

-- RenameIndex
ALTER INDEX "customer_quality_issues_org_item_idx" RENAME TO "customer_quality_issues_organization_id_item_id_idx";

-- RenameIndex
ALTER INDEX "customer_quality_issues_org_status_idx" RENAME TO "customer_quality_issues_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "effective_tax_rates_organization_id_effective_from_effective_id" RENAME TO "effective_tax_rates_organization_id_effective_from_effectiv_idx";

-- RenameIndex
ALTER INDEX "employee_compensations_organization_id_effective_from_effective" RENAME TO "employee_compensations_organization_id_effective_from_effec_idx";

-- RenameIndex
ALTER INDEX "inspection_characteristics_org_plan_code_key" RENAME TO "inspection_characteristics_organization_id_inspection_plan__key";

-- RenameIndex
ALTER INDEX "inspection_characteristics_org_plan_seq_idx" RENAME TO "inspection_characteristics_organization_id_inspection_plan__idx";

-- RenameIndex
ALTER INDEX "inspection_plans_organization_item_variant_type_ver_key" RENAME TO "inspection_plans_organization_id_item_id_variant_id_inspect_key";

-- RenameIndex
ALTER INDEX "inspection_results_org_lot_char_sample_key" RENAME TO "inspection_results_organization_id_inspection_lot_id_charac_key";

-- RenameIndex
ALTER INDEX "inspection_results_org_lot_idx" RENAME TO "inspection_results_organization_id_inspection_lot_id_idx";

-- RenameIndex
ALTER INDEX "inventory_balances_organization_id_location_id_item_id_variant_" RENAME TO "inventory_balances_organization_id_location_id_item_id_vari_key";

-- RenameIndex
ALTER INDEX "inventory_batches_organization_id_item_id_variant_id_location_i" RENAME TO "inventory_batches_organization_id_item_id_variant_id_locati_key";

-- RenameIndex
ALTER INDEX "inventory_cost_layers_organization_id_source_document_source__i" RENAME TO "inventory_cost_layers_organization_id_source_document_sourc_idx";

-- RenameIndex
ALTER INDEX "inventory_valuations_organization_id_item_id_variant_id_locat_i" RENAME TO "inventory_valuations_organization_id_item_id_variant_id_loc_idx";

-- RenameIndex
ALTER INDEX "non_conformances_org_item_idx" RENAME TO "non_conformances_organization_id_item_id_idx";

-- RenameIndex
ALTER INDEX "non_conformances_org_ncr_number_key" RENAME TO "non_conformances_organization_id_ncr_number_key";

-- RenameIndex
ALTER INDEX "non_conformances_org_severity_idx" RENAME TO "non_conformances_organization_id_severity_idx";

-- RenameIndex
ALTER INDEX "non_conformances_org_status_idx" RENAME TO "non_conformances_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "non_conformances_org_supplier_idx" RENAME TO "non_conformances_organization_id_supplier_id_idx";

-- RenameIndex
ALTER INDEX "production_material_issues_organization_id_production_order_id_" RENAME TO "production_material_issues_organization_id_production_order_idx";

-- RenameIndex
ALTER INDEX "quality_holds_org_hold_number_key" RENAME TO "quality_holds_organization_id_hold_number_key";

-- RenameIndex
ALTER INDEX "quality_holds_org_item_idx" RENAME TO "quality_holds_organization_id_item_id_idx";

-- RenameIndex
ALTER INDEX "quality_holds_org_status_idx" RENAME TO "quality_holds_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_gr_idx" RENAME TO "quality_inspection_lots_organization_id_goods_receipt_id_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_item_idx" RENAME TO "quality_inspection_lots_organization_id_item_id_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_lot_number_key" RENAME TO "quality_inspection_lots_organization_id_lot_number_key";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_po_prod_idx" RENAME TO "quality_inspection_lots_organization_id_production_order_id_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_status_idx" RENAME TO "quality_inspection_lots_organization_id_status_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_supplier_idx" RENAME TO "quality_inspection_lots_organization_id_supplier_id_idx";

-- RenameIndex
ALTER INDEX "quality_inspection_lots_org_type_idx" RENAME TO "quality_inspection_lots_organization_id_inspection_type_idx";

-- RenameIndex
ALTER INDEX "replenishment_rules_organization_id_item_id_variant_id_des_key" RENAME TO "replenishment_rules_organization_id_item_id_variant_id_dest_key";

-- RenameIndex
ALTER INDEX "shipment_packages_organization_id_shipment_id_package_number_ke" RENAME TO "shipment_packages_organization_id_shipment_id_package_numbe_key";

-- RenameIndex
ALTER INDEX "shipment_tracking_events_organization_id_shipment_id_event_time" RENAME TO "shipment_tracking_events_organization_id_shipment_id_event__idx";

-- RenameIndex
ALTER INDEX "supplier_debit_applications_organization_id_supplier_invoice_id" RENAME TO "supplier_debit_applications_organization_id_supplier_invoic_idx";

-- RenameIndex
ALTER INDEX "supplier_invoice_lines_organization_id_goods_receipt_line_id_id" RENAME TO "supplier_invoice_lines_organization_id_goods_receipt_line_i_idx";

-- RenameIndex
ALTER INDEX "supplier_invoice_lines_organization_id_purchase_order_line_id_i" RENAME TO "supplier_invoice_lines_organization_id_purchase_order_line__idx";
