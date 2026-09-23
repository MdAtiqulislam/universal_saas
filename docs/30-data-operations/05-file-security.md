# File Security & Formula Injection Defense

## Overview

The `FileSecurityUtil` (`apps/api/src/data-operations/utils/file-security.util.ts`) enforces strict perimeter and content validation for all uploaded and generated files.

---

## Security Controls

### 1. Server-Side Limits & Bounding (INV-535)

Import files must satisfy hard server-side bounds prior to processing:

- **Maximum File Size**: 10 MB default limit (configurable per operation).
- **Allowed MIME Types**: `text/csv`, `text/plain`, `application/vnd.ms-excel`.
- **Allowed File Extensions**: `.csv`, `.tsv`, `.txt`.
- **Maximum Columns**: 100 columns per row.
- **Maximum Rows**: 50,000 rows per import file.

Any file exceeding these boundaries is rejected before parsing begins with a `BadRequestException`.

### 2. Path Traversal & Filename Sanitization

User-provided filenames can be vectors for directory traversal attacks:

- `FileSecurityUtil.sanitizeFilename` strips path traversal components (`../`, `..\\`), leading slashes, and non-alphanumeric special characters (except `_`, `-`, and `.`).
- Filenames are truncated to 128 characters.
- System-generated file paths are prefixed with deterministic tenant directory identifiers: `data-operations/{organizationId}/{jobId}/...`.

### 3. Formula Injection Neutralization (CSV Injection)

Spreadsheet applications evaluate cell contents starting with formula syntax triggers. An attacker could inject payloads such as:
`=cmd|'/C calc'!A0` or `@SUM(1+1)*cmd|' /C notepad.exe'!A0`
`FileSecurityUtil.sanitizeCsvValue` protects against this by prepending `'` to any value starting with:

- `=` (Equal sign)
- `+` (Plus sign)
- `-` (Minus sign)
- `@` (At symbol)
- `\t` (Tab)
- `\r` (Carriage return)

### 4. Tenant Storage Isolation (INV-542)

All export artifacts and error reports are stored under tenant-isolated paths. File access and download requests require active tenant membership and operation permissions (`data_operations.jobs.view`). Download tokens expire after 15 minutes.
