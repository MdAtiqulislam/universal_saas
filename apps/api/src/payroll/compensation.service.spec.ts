import { Test, TestingModule } from '@nestjs/testing';
import { CompensationService } from './compensation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

describe('CompensationService', () => {
  let service: CompensationService;
  let prisma: {
    employee: { findFirst: jest.Mock };
    employeeCompensation: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let eventBus: { publish: jest.Mock };

  const orgId = 'org-101';
  const empId = 'emp-101';
  const userId = 'user-101';

  beforeEach(async () => {
    prisma = {
      employee: { findFirst: jest.fn() },
      employeeCompensation: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompensationService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<CompensationService>(CompensationService);
  });

  describe('create', () => {
    it('should create compensation record and publish event', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: empId,
        organizationId: orgId,
      });
      prisma.employeeCompensation.findMany.mockResolvedValue([]);
      prisma.employeeCompensation.create.mockImplementation(({ data }) => ({
        id: 'comp-1',
        ...data,
      }));

      const res = await service.create(
        orgId,
        {
          employeeId: empId,
          effectiveFrom: '2026-01-01',
          baseSalary: 5000,
          housingAllowance: 1000,
        },
        userId,
      );

      expect(res.id).toBe('comp-1');
      expect(res.baseSalary).toEqual(new Prisma.Decimal(5000));
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'COMPENSATION_CREATED' }),
      );
    });

    it('should reject overlapping compensation dates', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: empId,
        organizationId: orgId,
      });
      prisma.employeeCompensation.findMany.mockResolvedValue([
        {
          id: 'comp-existing',
          effectiveFrom: new Date('2026-01-01'),
          effectiveUntil: new Date('2026-06-30'),
        },
      ]);

      await expect(
        service.create(
          orgId,
          {
            employeeId: empId,
            effectiveFrom: '2026-04-01',
            effectiveUntil: '2026-12-31',
            baseSalary: 6000,
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findEffective', () => {
    it('should query active compensation matching effective date', async () => {
      const targetDate = new Date('2026-03-15');
      prisma.employeeCompensation.findFirst.mockResolvedValue({
        id: 'comp-1',
        baseSalary: new Prisma.Decimal(5000),
      });

      const res = await service.findEffective(orgId, empId, targetDate);

      expect(prisma.employeeCompensation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
            employeeId: empId,
            effectiveFrom: { lte: targetDate },
          }),
        }),
      );
      expect(res?.baseSalary).toEqual(new Prisma.Decimal(5000));
    });
  });
});
