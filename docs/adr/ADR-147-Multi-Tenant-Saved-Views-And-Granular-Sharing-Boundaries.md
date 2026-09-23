# ADR-147: Multi-Tenant Saved Views and Granular Sharing Boundaries

**Status:** Accepted  
**Date:** 2026-09-11  
**Milestone:** M44

## Context

Operational users spend substantial time configuring filters, column selections, and sort orders for daily workflows. These configurations must be persistable as Saved Views with clear privacy and collaboration boundaries without enabling privilege escalation or unauthorized data exposure.

## Decision

1. **Three-Tier Visibility Model (`INV-477`, `INV-491`)**:
   - `PERSONAL`: Accessible exclusively by the owner user (`INV-491`). Hidden from all other tenant users.
   - `SHARED`: Accessible by the owner and explicitly designated same-tenant principals (`INV-492`).
   - `TENANT`: Accessible by all active members of the tenant organization.
2. **Same-Tenant Principal Validation (`INV-492`)**:
   - Sharing a view verifies that the target principal (user or role) belongs to the exact same `organizationId`. Cross-tenant sharing is strictly prohibited at the service layer.
3. **Permission Preservation (`INV-494`)**:
   - Loading or executing a shared saved view evaluates underlying domain record permissions for the current caller. Sharing a view never grants access to records the caller is not authorized to read.

## Consequences

- Full privacy for personal exploration workflows.
- Secure, validated collaboration across teams within an organization.
- Zero risk of horizontal data leakage through shared view filters.
