# ADR-064: BOM Explosion & Net Requirements Strategy

## Status

Accepted

## Context

Multi-level manufacturing structures require recursive bill-of-materials explosion with scrap allowances, cycle detection, and chronological net requirement netting against available supply and safety stock.

## Decision

1. Implement `BomExplosionService` with recursive depth tracking and cycle detection via visited item sets.
2. Apply scrap multiplier formula: $\text{GrossQty} = \text{DemandQty} \times \frac{\text{LineQty}}{\text{BomQty}} \times (1 + \frac{\text{ScrapPercentage}}{100})$.
3. Implement chronological net requirement formula using exact `Prisma.Decimal` arithmetic:
   $$\text{NetRequirement} = \max(0, \text{GrossDemand} + \text{SafetyStock} - \text{AvailableStock} - \text{ExpectedSupply})$$
4. Apply lot sizing rules: Minimum Order Quantity (MOQ) floor and Order Multiple ceiling rounding.
5. Offset planned order dates by supplier or manufacturing lead times.

## Consequences

- Accurate component demand generation down to raw material tier.
- Prevention of stack overflow through graph cycle detection.
- Zero floating-point drift in high-volume supply chains.
