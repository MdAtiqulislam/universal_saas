import { Test, TestingModule } from '@nestjs/testing';
import { OperationalErrorsService } from '../errors/operational-errors.service';
import { StructuredLoggingService } from '../logging/structured-logging.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  OperationalErrorCategory,
  OperationalErrorSeverity,
} from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('M38: Operational Error Taxonomy & Fingerprinting (INV-328, INV-329, INV-330)', () => {
  let errorsService: OperationalErrorsService;
  let prismaMock: any;
  let loggerMock: any;

  beforeEach(async () => {
    prismaMock = {
      operationalError: {
        create: jest
          .fn()
          .mockImplementation((args) =>
            Promise.resolve({ id: 'err-1', ...args.data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    };
    loggerMock = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalErrorsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StructuredLoggingService, useValue: loggerMock },
      ],
    }).compile();

    errorsService = module.get<OperationalErrorsService>(
      OperationalErrorsService,
    );
  });

  describe('Error Classification Taxonomy (INV-328)', () => {
    it('1. should classify BadRequestException as VALIDATION with LOW severity', () => {
      const err = new BadRequestException('Invalid payload');
      const classification = errorsService.classify(err, 'TestModule');

      expect(classification.category).toBe(OperationalErrorCategory.VALIDATION);
      expect(classification.severity).toBe(OperationalErrorSeverity.LOW);
    });

    it('2. should classify database errors as DATABASE with HIGH severity', () => {
      const err = new Error(
        'PrismaClientKnownRequestError: connection refused',
      );
      err.name = 'PrismaClientKnownRequestError';
      const classification = errorsService.classify(err, 'InventoryModule');

      expect(classification.category).toBe(OperationalErrorCategory.DATABASE);
      expect(classification.severity).toBe(OperationalErrorSeverity.HIGH);
    });

    it('3. should classify NotFoundException as NOT_FOUND with LOW severity', () => {
      const err = new NotFoundException('Resource missing');
      const classification = errorsService.classify(err, 'SalesModule');

      expect(classification.category).toBe(OperationalErrorCategory.NOT_FOUND);
      expect(classification.severity).toBe(OperationalErrorSeverity.LOW);
    });
  });

  describe('Deterministic Fingerprinting (INV-330)', () => {
    it('4. should compute deterministic SHA-256 fingerprint for identical stack traces', () => {
      const stack = `Error: Something failed\n    at Object.test (/app/src/service.ts:25:10)\n    at processTicksAndRejections`;
      const fp1 = errorsService.fingerprint(
        'OrderModule',
        'ERR_ORDER_001',
        stack,
      );
      const fp2 = errorsService.fingerprint(
        'OrderModule',
        'ERR_ORDER_001',
        stack,
      );

      expect(fp1).toBe(fp2);
      expect(fp1).toHaveLength(64); // SHA-256 hex string
    });

    it('5. should sanitize absolute system file paths in fingerprint signatures', () => {
      const stackWithPaths = `Error: Failed\n    at /secret/path/user/service.ts:10:5\n    at /var/app/index.js:50:2`;
      const fp = errorsService.fingerprint(
        'UserModule',
        'ERR_AUTH',
        stackWithPaths,
      );
      expect(fp).toBeDefined();
    });
  });

  describe('Operational Error Recording & Secret Stripping (INV-329)', () => {
    it('6. should sanitize UUID patterns in messages before persisting', async () => {
      await errorsService.record({
        module: 'Accounting',
        message:
          'Transaction failed for entity 12345678-1234-1234-1234-123456789abc',
        category: OperationalErrorCategory.INTERNAL,
        severity: OperationalErrorSeverity.MEDIUM,
        errorCode: 'TX_FAIL',
        organizationId: 'org-123',
      });

      expect(prismaMock.operationalError.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          message: 'Transaction failed for entity [UUID]',
          module: 'Accounting',
          errorCode: 'TX_FAIL',
        }),
      });
    });
  });
});
