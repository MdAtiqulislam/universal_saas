# 08 - Developer Portal User Guide

## Accessing the Developer Portal

The Developer Portal is accessible to tenant users with `developer.portal.access` or `developer.admin` permissions at:
`/admin/developer`

## Portal Tabs & Workflows

### 1. Overview

Displays high-level KPI cards:

- Total Requests (24h)
- Success Rate (%)
- P95 Latency (ms)
- Active API Keys
- Rate Limit Quota Remaining
- Total Registered Public Endpoints
- Recent Errors & Invocations Feed

### 2. API Keys

Provides links and interfaces to view existing keys (`pk_live_...`), view bound scopes, rotate keys, and revoke keys (reusing M39 API key governance).

### 3. API Reference

Searchable interactive documentation of all registered public endpoints categorized by domain (`Accounting`, `CRM`, `Inventory`, `Webhooks`, `Workflows`).
Features parameter tables, request body schemas, response samples, and direct download of `openapi.json`.

### 4. API Explorer

A sandboxed in-browser API console. Allows engineers to select an endpoint, configure path/query parameters and request payload, and execute the request securely against the tenant's live backend.

### 5. Usage & Telemetry

Visual analytics showing request volume over time, HTTP status code distribution (2xx, 4xx, 5xx), average and percentile latency, and route-by-route breakdowns. Supports one-click tenant-isolated CSV export.

### 6. Error Catalog

Comprehensive reference guide of standard error codes, HTTP statuses, and recommended resolution steps for client developers.

### 7. Webhook Documentation

Developer documentation detailing outbound webhook subscription setup, payload schemas, signature validation (`X-Webhook-Signature` HMAC-SHA256), and retry policies.

### 8. API Versions

Timeline and changelog of platform API versions (`v1.0.0`, `v1.1.0`), showing active statuses, deprecation dates, and migration guides.
