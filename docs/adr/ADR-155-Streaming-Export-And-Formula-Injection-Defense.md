# ADR-155: Streaming Export and Formula Injection Defense

## Status

Accepted

## Context

Bulk data export from multi-tenant databases introduces significant security and stability challenges:

1. **Memory Exhaustion**: Loading unbounded record sets into server memory causes OOM crashes and CPU exhaustion.
2. **Formula Injection (CSV Injection / CWE-1236)**: User-controlled fields beginning with spreadsheet formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) can execute malicious code or exfiltrate data when opened in spreadsheet software (Microsoft Excel, LibreOffice, Google Sheets).
3. **Tenant Data Leakage**: Unpartitioned export queries can inadvertently return cross-tenant records.

## Decision

1. **Mandatory Tenant Partitioning**: Every export query enforces `where.organizationId = organizationId` at the database level, preventing any records outside the caller's tenant from ever being queried (INV-528).
2. **Deterministic Chunking & Streaming**: Exports are processed in deterministic chunk sizes (default 500 rows, up to platform bound of 10,000 rows per sync export) ordered by primary key (`id ASC`). Asynchronous exports utilize M36 `JobService` for bounded background serialization.
3. **Formula Injection Neutralization**: `FileSecurityUtil.sanitizeCsvValue` inspects every cell string. Any value starting with formula trigger characters (`=`, `+`, `-`, `@`, `\t`, `\r`) is prefixed with a single quote (`'`), neutralizing executable expressions across all spreadsheet viewers.
4. **RFC 4180 Escaping**: Fields containing commas, quotes, or newlines are wrapped in double quotes, with internal quotes doubled (`""`).
5. **Secure Storage & Download Tokens**: Generated export artifacts are stored in tenant-scoped object storage with expiring signed tokens, preventing unauthorized or cross-tenant downloads (INV-542).

## Consequences

### Positive

- Protection against CVE-grade spreadsheet formula injection attacks.
- Predictable bounded memory usage even during large-scale exports.
- Complete tenant boundary isolation guaranteed at query level.

## Related Invariants

- `INV-527`: Single Tenant Organization Context
- `INV-528`: Export Tenant Boundary Protection
- `INV-534`: Zero Arbitrary SQL or Dynamic Code
- `INV-535`: Server-Side File Validation & Formatting
- `INV-542`: Tenant-Scoped Result File Access
