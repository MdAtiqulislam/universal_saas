import { Injectable, BadRequestException } from '@nestjs/common';

export interface ProrationResult {
  totalPeriodDays: number;
  remainingDays: number;
  usedDays: number;
  unusedCurrentPlanCredit: number; // minor units
  newPlanCharge: number; // minor units
  netPayableAmount: number; // minor units (>= 0)
  refundOrCreditAmount: number; // minor units (if downgrade produces excess credit)
}

@Injectable()
export class ProrationService {
  /**
   * Deterministic proration using integer minor units.
   * Calculates unused balance on current plan and charges for remaining days on new plan.
   */
  calculateProration(params: {
    currentPlanPriceMinorUnits: number;
    newPlanPriceMinorUnits: number;
    periodStart: Date;
    periodEnd: Date;
    effectiveDate?: Date;
  }): ProrationResult {
    const {
      currentPlanPriceMinorUnits,
      newPlanPriceMinorUnits,
      periodStart,
      periodEnd,
    } = params;
    const effective = params.effectiveDate || new Date();

    const startMs = periodStart.getTime();
    const endMs = periodEnd.getTime();
    const effectiveMs = Math.min(Math.max(effective.getTime(), startMs), endMs);

    const totalMs = endMs - startMs;
    if (totalMs <= 0) {
      throw new BadRequestException('Invalid billing period duration');
    }

    const remainingMs = endMs - effectiveMs;

    const totalPeriodDays = Math.max(
      1,
      Math.round(totalMs / (1000 * 60 * 60 * 24)),
    );
    const remainingDays = Math.round(remainingMs / (1000 * 60 * 60 * 24));
    const usedDays = totalPeriodDays - remainingDays;

    // Ratio in basis points (10,000 = 100%) to preserve precision with integer arithmetic
    const remainingRatioBps = Math.round((remainingMs / totalMs) * 10000);

    // Unused portion of current plan
    const unusedCurrentPlanCredit = Math.round(
      (currentPlanPriceMinorUnits * remainingRatioBps) / 10000,
    );

    // Pro-rated charge on new plan
    const newPlanCharge = Math.round(
      (newPlanPriceMinorUnits * remainingRatioBps) / 10000,
    );

    const net = newPlanCharge - unusedCurrentPlanCredit;
    const netPayableAmount = Math.max(0, net);
    const refundOrCreditAmount = net < 0 ? Math.abs(net) : 0;

    return {
      totalPeriodDays,
      remainingDays,
      usedDays,
      unusedCurrentPlanCredit,
      newPlanCharge,
      netPayableAmount,
      refundOrCreditAmount,
    };
  }
}
