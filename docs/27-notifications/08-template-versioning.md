# 08. Immutable Template Versions & Integrity

## Versioning & Integrity Model

Templates support draft evolution and immutable production deployments:

- **Version Immobility (`INV-458`)**:
  - Once a `NotificationTemplateVersion` is published, its database row is immutable.
  - Updates increment `version` sequentially and publish a new immutable snapshot.
- **Cryptographic Snapshot Hashing (`INV-459`)**:
  - Published versions compute an authoritative SHA-256 integrity hash over:
    `SHA256(version + ":" + subject + ":" + body + ":" + channels.sort().join(","))`
  - Dispatches re-verify the stored hash before executing renders to detect database tampering.
- **System Templates**:
  - Default platform templates (e.g., password reset, invoice receipt, security alerts) are flagged `isSystem: true` and cannot be deleted by tenants.
