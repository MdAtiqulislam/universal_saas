import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Prisma,
  InspectionDecision,
  NonConformanceSeverity,
} from '@prisma/client';

export interface DecisionEvaluationResult {
  canAccept: boolean;
  hasFailures: boolean;
  missingMandatoryCount: number;
  totalResults: number;
  failedResultsCount: number;
  passedResultsCount: number;
}

@Injectable()
export class InspectionDecisionService {
  /**
   * Deterministically evaluates recorded results against inspection plan characteristics.
   */
  evaluateResults(
    characteristics: {
      id: string;
      code: string;
      isMandatory: boolean;
      dataType: string;
      minSpec?: Prisma.Decimal | null;
      maxSpec?: Prisma.Decimal | null;
    }[],
    results: {
      characteristicId: string;
      sampleNumber: number;
      isPass: boolean;
      observedNumericValue?: Prisma.Decimal | null;
    }[],
    sampleQuantity: number,
  ): DecisionEvaluationResult {
    let hasFailures = false;
    let failedResultsCount = 0;
    let passedResultsCount = 0;

    const resultMap = new Map<string, Set<number>>();
    for (const r of results) {
      if (!resultMap.has(r.characteristicId)) {
        resultMap.set(r.characteristicId, new Set<number>());
      }
      resultMap.get(r.characteristicId)!.add(r.sampleNumber);

      if (!r.isPass) {
        hasFailures = true;
        failedResultsCount++;
      } else {
        passedResultsCount++;
      }
    }

    let missingMandatoryCount = 0;
    for (const char of characteristics) {
      if (char.isMandatory) {
        const samples = resultMap.get(char.id) || new Set<number>();
        // Check if all samples have results for this mandatory characteristic
        for (let s = 1; s <= sampleQuantity; s++) {
          if (!samples.has(s)) {
            missingMandatoryCount++;
          }
        }
      }
    }

    const canAccept = !hasFailures && missingMandatoryCount === 0;

    return {
      canAccept,
      hasFailures,
      missingMandatoryCount,
      totalResults: results.length,
      failedResultsCount,
      passedResultsCount,
    };
  }

  /**
   * Validates if the proposed decision is permitted based on evaluation and policy.
   */
  validateDecision(
    decision: InspectionDecision,
    evaluation: DecisionEvaluationResult,
    requireAllMandatory = true,
  ) {
    if (requireAllMandatory && evaluation.missingMandatoryCount > 0) {
      throw new BadRequestException(
        `Cannot decide lot: ${evaluation.missingMandatoryCount} mandatory characteristic sample measurements are missing`,
      );
    }

    if (decision === InspectionDecision.ACCEPT && evaluation.hasFailures) {
      throw new BadRequestException(
        'Cannot decide ACCEPT when inspection results contain failures. Use ACCEPT_WITH_DEVIATION, REWORK, REJECT, SCRAP, RETURN_TO_SUPPLIER, or HOLD.',
      );
    }
  }

  /**
   * Determines default severity for an NCR based on decision.
   */
  getSuggestedNcrSeverity(
    decision: InspectionDecision,
  ): NonConformanceSeverity {
    switch (decision) {
      case InspectionDecision.SCRAP:
      case InspectionDecision.RETURN_TO_SUPPLIER:
        return NonConformanceSeverity.HIGH;
      case InspectionDecision.REJECT:
        return NonConformanceSeverity.HIGH;
      case InspectionDecision.REWORK:
        return NonConformanceSeverity.MEDIUM;
      case InspectionDecision.ACCEPT_WITH_DEVIATION:
        return NonConformanceSeverity.LOW;
      default:
        return NonConformanceSeverity.MEDIUM;
    }
  }
}
