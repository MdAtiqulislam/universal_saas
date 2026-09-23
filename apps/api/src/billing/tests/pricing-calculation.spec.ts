import { BadRequestException } from '@nestjs/common';
import { ProrationService } from '../services/proration.service';

describe('Pricing & Proration Calculation Engine (M42)', () => {
  let service: ProrationService;

  beforeEach(() => {
    service = new ProrationService();
  });

  it('should calculate upgrade proration accurately using basis-point precision', () => {
    // Current plan: $100/mo (10000 cents). New plan: $200/mo (20000 cents).
    // Exactly half-way through a 30-day period (15 days remaining).
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-30T00:00:00Z');
    const mid = new Date('2026-06-15T12:00:00Z');

    const result = service.calculateProration({
      currentPlanPriceMinorUnits: 10000,
      newPlanPriceMinorUnits: 20000,
      periodStart: start,
      periodEnd: end,
      effectiveDate: mid,
    });

    expect(result.totalPeriodDays).toBe(29);
    expect(result.unusedCurrentPlanCredit).toBe(5000); // 50% of $100 = $50
    expect(result.newPlanCharge).toBe(10000); // 50% of $200 = $100
    expect(result.netPayableAmount).toBe(5000); // Net charge: $50
    expect(result.refundOrCreditAmount).toBe(0);
  });

  it('should calculate downgrade proration producing credit balance', () => {
    // Current plan: $300/mo (30000 cents). New plan: $100/mo (10000 cents).
    // 10 days remaining out of 30 days (1/3 remaining).
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-07-01T00:00:00Z');
    const effective = new Date('2026-06-21T00:00:00Z'); // 10 days left

    const result = service.calculateProration({
      currentPlanPriceMinorUnits: 30000,
      newPlanPriceMinorUnits: 10000,
      periodStart: start,
      periodEnd: end,
      effectiveDate: effective,
    });

    expect(result.unusedCurrentPlanCredit).toBeGreaterThan(0);
    expect(result.newPlanCharge).toBeGreaterThan(0);
    expect(result.unusedCurrentPlanCredit).toBeGreaterThan(
      result.newPlanCharge,
    );
    expect(result.netPayableAmount).toBe(0);
    expect(result.refundOrCreditAmount).toBe(
      result.unusedCurrentPlanCredit - result.newPlanCharge,
    );
  });

  it('should reject invalid billing period durations (start >= end)', () => {
    const start = new Date('2026-06-30T00:00:00Z');
    const end = new Date('2026-06-01T00:00:00Z');

    expect(() =>
      service.calculateProration({
        currentPlanPriceMinorUnits: 10000,
        newPlanPriceMinorUnits: 20000,
        periodStart: start,
        periodEnd: end,
      }),
    ).toThrow(BadRequestException);
  });

  it('should handle same-day edge case at end of period with zero net charge', () => {
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-30T00:00:00Z');
    const effective = new Date('2026-06-30T00:00:00Z'); // End of period

    const result = service.calculateProration({
      currentPlanPriceMinorUnits: 5000,
      newPlanPriceMinorUnits: 15000,
      periodStart: start,
      periodEnd: end,
      effectiveDate: effective,
    });

    expect(result.unusedCurrentPlanCredit).toBe(0);
    expect(result.newPlanCharge).toBe(0);
    expect(result.netPayableAmount).toBe(0);
    expect(result.refundOrCreditAmount).toBe(0);
  });
});
