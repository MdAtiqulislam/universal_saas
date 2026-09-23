import { Test, TestingModule } from '@nestjs/testing';
import { EmployeesService } from './employees.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { EmploymentStatus, EmploymentType } from '@prisma/client';

describe('EmployeesService', () => {
  let service: EmployeesService;
  let prisma: {
    employee: {
      create: jest.Mock;
      count: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
    department: { findFirst: jest.Mock };
    jobPosition: { findFirst: jest.Mock };
  };
  let eventBus: { publish: jest.Mock };

  const orgId = 'org-101';
  const userId = 'user-101';

  beforeEach(async () => {
    prisma = {
      employee: {
        create: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      department: { findFirst: jest.fn() },
      jobPosition: { findFirst: jest.fn() },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
  });

  describe('create', () => {
    it('should create an employee successfully and publish event', async () => {
      prisma.employee.count.mockResolvedValue(0);
      prisma.employee.findFirst.mockResolvedValue(null);
      prisma.employee.create.mockImplementation(({ data }) => ({
        id: 'emp-1',
        ...data,
      }));

      const res = await service.create(
        orgId,
        {
          firstName: 'John',
          lastName: 'Doe',
          hireDate: '2026-01-01',
          employmentStatus: EmploymentStatus.ACTIVE,
          employmentType: EmploymentType.FULL_TIME,
        },
        userId,
      );

      expect(res.employeeNumber).toBe('EMP-00001');
      expect(res.displayName).toBe('John Doe');
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EMPLOYEE_CREATED' }),
      );
    });

    it('should reject if termination date is before hire date', async () => {
      await expect(
        service.create(
          orgId,
          {
            firstName: 'Jane',
            lastName: 'Doe',
            hireDate: '2026-06-01',
            terminationDate: '2026-05-01',
          },
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if employeeNumber already exists', async () => {
      prisma.employee.findFirst.mockResolvedValue({ id: 'emp-existing' });

      await expect(
        service.create(
          orgId,
          {
            employeeNumber: 'EMP-00001',
            firstName: 'John',
            lastName: 'Doe',
            hireDate: '2026-01-01',
          },
          userId,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should prevent employee from being their own manager', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
        organizationId: orgId,
        hireDate: new Date('2026-01-01'),
        deletedAt: null,
      });

      await expect(
        service.update(orgId, 'emp-1', { managerEmployeeId: 'emp-1' }, userId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit EMPLOYEE_TERMINATED event when status is changed to TERMINATED', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
        organizationId: orgId,
        employmentStatus: EmploymentStatus.ACTIVE,
        hireDate: new Date('2026-01-01'),
        deletedAt: null,
      });
      prisma.employee.update.mockResolvedValue({
        id: 'emp-1',
        employmentStatus: EmploymentStatus.TERMINATED,
        employeeNumber: 'EMP-00001',
        displayName: 'John Doe',
      });

      await service.update(
        orgId,
        'emp-1',
        { employmentStatus: EmploymentStatus.TERMINATED },
        userId,
      );

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EMPLOYEE_TERMINATED' }),
      );
    });
  });

  describe('delete', () => {
    it('should soft-delete employee and emit EMPLOYEE_TERMINATED event', async () => {
      prisma.employee.findFirst.mockResolvedValue({
        id: 'emp-1',
        organizationId: orgId,
        deletedAt: null,
      });
      prisma.employee.update.mockResolvedValue({
        id: 'emp-1',
        employeeNumber: 'EMP-00001',
        employmentStatus: EmploymentStatus.TERMINATED,
      });

      await service.delete(orgId, 'emp-1', userId);

      expect(prisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-1' },
        data: expect.objectContaining({
          employmentStatus: EmploymentStatus.TERMINATED,
        }),
      });
      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ eventName: 'EMPLOYEE_TERMINATED' }),
      );
    });
  });
});
