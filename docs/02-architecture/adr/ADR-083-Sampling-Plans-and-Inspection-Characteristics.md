# ADR-083: Sampling Plans and Inspection Characteristics

## Status

Accepted (Milestone M31)

## Context

Industrial quality control requires statistical sampling schemes (ANSI/ASQ Z1.4, ISO 2859-1) and parametric inspection criteria. Inspection criteria range from quantitative dimensional measurements with upper/lower tolerance limits to qualitative attributes (pass/fail visual checks) and text observation logs.

Inspection plans and characteristics must support strict version control so that changes in specifications do not alter the historical criteria used to evaluate past production or procurement lots.

## Decision

1. **Statistical Sampling Schemes**:
   - `SamplingPlan` supports 4 standard sampling formulas:
     - `FULL_100_PERCENT`: Sample size equals lot size.
     - `FIXED_QUANTITY`: Constant sample size (e.g. 5 units), capped at lot quantity.
     - `PERCENTAGE_BASED`: Fixed percentage (e.g. 10%), ceil-rounded and bounded.
     - `LOT_SIZE_BASED`: Tabular lookup ranges specifying sample size based on total lot quantity.
   - Sampling calculations operate deterministically on exact `Prisma.Decimal` amounts.

2. **Inspection Characteristic Specifications**:
   - Each `InspectionCharacteristic` belongs to an `InspectionPlan` and defines:
     - `dataType`: `NUMERIC_SPEC`, `QUALITATIVE_PASS_FAIL`, or `TEXT_OBSERVATION`.
     - `sequence`: Integer ordering for execution order.
     - Tolerances: `targetValue`, `minSpec`, `maxSpec`, `tolerance`, and `unitOfMeasure`.
     - `isMandatory`: Boolean flag enforcing that every sample unit must record this spec before acceptance.

3. **Plan Versioning & Immutability**:
   - Inspection plans are uniquely versioned by `(organizationId, itemId, variantId, inspectionType, version)`.
   - Once an inspection plan is linked to an active `QualityInspectionLot`, it is locked with `isImmutable = true`.
   - Modifications require publishing a new version increment (e.g. v1 -> v2) without modifying historical plan specs.

## Consequences

### Positive

- Flexible sampling schemes adaptable to incoming goods, continuous shop floor manufacturing, and outbound shipping.
- Zero risk of retrospective quality data alteration when engineering tolerances change.
- Exact compliance tracking on quantitative and qualitative criteria.

### Negative

- Plan modifications require creating new versions and re-activating them.
