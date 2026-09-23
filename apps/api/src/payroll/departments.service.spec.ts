import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentsService } from './departments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException, ConflictException } from '@nestjs/common';

describe('DepartmentsService', () => {
  let service: DepartmentsService;
  let prisma: {
    department: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    employee: {
      count: jest.Mock;
    };
  };
  let eventBus: { publish: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';

  beforeEach(async () => {
    prisma = {
      department: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      employee: {
        count: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<DepartmentsService>(DepartmentsService);
  });

  describe('create', () => {
    it('should create department and publish event', async () => {
      prisma.department.findFirst.mockResolvedValue(null);
      prisma.department.create.mockResolvedValue({
        id: 'dept-1',
        organizationId: orgId,
        code: 'ENG',
        name: 'Engineering',
      });

      const res = await service.create(
        orgId,
        { code: 'ENG', name: 'Engineering' },
        userId,
      );

      expect(res.id).toBe('dept-1');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'DEPARTMENT_CREATED' }),
      );
    });

    it('should prevent duplicate department code in same organization', async () => {
      prisma.department.findFirst.mockResolvedValue({ id: 'dept-existing' });

      await expect(
        service.create(orgId, { code: 'ENG', name: 'Engineering' }, userId),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update - circular ancestry detection', () => {
    it('should prevent department from being its own parent', async () => {
      prisma.department.findFirst.mockResolvedValue({
        id: 'dept-1',
        organizationId: orgId,
        code: 'ENG',
        name: 'Engineering',
      });

      await expect(
        service.update(
          orgId,
          'dept-1',
          { parentDepartmentId: 'dept-1' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent indirect circular cycle (A -> B -> A)', async () => {
      // dept-1 tries to set parent to dept-2, but dept-2 already has parent dept-1
      prisma.department.findFirst
        .mockResolvedValueOnce({
          id: 'dept-1',
          organizationId: orgId,
          code: 'ENG',
          name: 'Engineering',
        })
        .mockResolvedValueOnce({
          parentDepartmentId: 'dept-1',
        });

      await expect(
        service.update(
          orgId,
          'dept-1',
          { parentDepartmentId: 'dept-2' },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
