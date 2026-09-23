import { Test, TestingModule } from '@nestjs/testing';
import { InspectionDecisionService } from './inspection-decision.service';
import { InspectionDecision, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('InspectionDecisionService', () => {
  let service: InspectionDecisionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InspectionDecisionService],
    }).compile();

    service = module.get<InspectionDecisionService>(InspectionDecisionService);
  });

  it('should evaluate passing results correctly when all mandatory characteristics pass', () => {
    const characteristics = [
      {
        id: 'char-1',
        code: 'DIM-01',
        isMandatory: true,
        dataType: 'NUMERIC_VALUE',
      },
    ];

    const results = [
      {
        characteristicId: 'char-1',
        sampleNumber: 1,
        isPass: true,
        observedNumericValue: new Prisma.Decimal('10.0'),
      },
      {
        characteristicId: 'char-1',
        sampleNumber: 2,
        isPass: true,
        observedNumericValue: new Prisma.Decimal('10.1'),
      },
    ];

    const evalResult = service.evaluateResults(characteristics, results, 2);
    expect(evalResult.canAccept).toBe(true);
    expect(evalResult.hasFailures).toBe(false);
    expect(evalResult.missingMandatoryCount).toBe(0);
  });

  it('should flag failure when any sample fails', () => {
    const characteristics = [
      {
        id: 'char-1',
        code: 'DIM-01',
        isMandatory: true,
        dataType: 'NUMERIC_VALUE',
      },
    ];

    const results = [
      {
        characteristicId: 'char-1',
        sampleNumber: 1,
        isPass: true,
        observedNumericValue: new Prisma.Decimal('10.0'),
      },
      {
        characteristicId: 'char-1',
        sampleNumber: 2,
        isPass: false,
        observedNumericValue: new Prisma.Decimal('15.0'),
      },
    ];

    const evalResult = service.evaluateResults(characteristics, results, 2);
    expect(evalResult.canAccept).toBe(false);
    expect(evalResult.hasFailures).toBe(true);
  });

  it('should throw BadRequestException when trying to decide ACCEPT on failed results', () => {
    const evaluation = {
      canAccept: false,
      hasFailures: true,
      missingMandatoryCount: 0,
      totalResults: 2,
      failedResultsCount: 1,
      passedResultsCount: 1,
    };

    expect(() =>
      service.validateDecision(InspectionDecision.ACCEPT, evaluation, true),
    ).toThrow(BadRequestException);
  });
});
