# ADR-100: Lead Qualification & Atomic One-Click Conversion

## Status

Accepted

## Context

Prospective client data in CRM enters as raw leads. Leads must undergo structured qualification before committing authoritative customer records and opening deals in the commercial pipeline.

## Decision

1. Maintain `Lead` entity with statuses: `NEW`, `CONTACTED`, `QUALIFIED`, `UNQUALIFIED`, `CONVERTED`, `LOST`, `CLOSED`.
2. Provide a 1-click atomic conversion transaction (`CrmLeadsService.convert`) that:
   - Finds or creates authoritative `Customer` and `CustomerContact`.
   - Creates an `Opportunity` aggregate in stage `QUALIFICATION`.
   - Updates `Lead` to `CONVERTED`, recording `convertedCustomerId`, `convertedOpportunityId`, `convertedAt`, and `convertedByUserId`.
   - Emits `LEAD_CONVERTED` domain event.
3. Invariant: Converted, lost, or closed leads are strictly prevented from double conversion.

## Consequences

- Guaranteed referential consistency across presales leads and customer master records.
- Prevents orphaned leads or duplicate customer creation during rapid sales handoffs.
