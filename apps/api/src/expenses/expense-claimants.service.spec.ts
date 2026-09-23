import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseClaimantsService } from './expense-claimants.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ExpenseClaimantsService', () => {
  let service: ExpenseClaimantsService;
  let prisma: any;
  let eventBus: any;

  const orgId = 'org-test-1';
  const userId = 'user-test-1';

  beforeEach(async () => {
    prisma = {
      expenseClaimant: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      paymentAccount: {
        findFirst: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseClaimantsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<ExpenseClaimantsService>(ExpenseClaimantsService);
  });

  it('should create an expense claimant successfully', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null);
    prisma.expenseClaimant.create.mockResolvedValue({
      id: 'claimant-1',
      organizationId: orgId,
      name: 'Alice Smith',
      employeeNumber: 'EMP-001',
      department: 'Engineering',
      isActive: true,
    });

    const result = await service.create(
      orgId,
      {
        name: 'Alice Smith',
        employeeNumber: 'EMP-001',
        department: 'Engineering',
      },
      userId,
    );

    expect(result.id).toBe('claimant-1');
    expect(result.name).toBe('Alice Smith');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'EXPENSE_CLAIMANT_CREATED',
        organizationId: orgId,
      }),
    );
  });

  it('should reject duplicate employee number in the same organization', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue({
      id: 'claimant-existing',
      employeeNumber: 'EMP-001',
    });

    await expect(
      service.create(
        orgId,
        {
          name: 'Bob Jones',
          employeeNumber: 'EMP-001',
        },
        userId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should validate default payment account belongs to organization', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null);
    prisma.paymentAccount.findFirst.mockResolvedValue(null); // Not found

    await expect(
      service.create(
        orgId,
        {
          name: 'Charlie Brown',
          employeeNumber: 'EMP-002',
          defaultPaymentAccountId: 'pay-acc-foreign',
        },
        userId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should find one claimant by id', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue({
      id: 'claimant-1',
      organizationId: orgId,
      name: 'Alice Smith',
    });

    const result = await service.findOne(orgId, 'claimant-1');
    expect(result.id).toBe('claimant-1');
  });

  it('should throw NotFoundException if claimant not found', async () => {
    prisma.expenseClaimant.findFirst.mockResolvedValue(null);

    await expect(service.findOne(orgId, 'non-existent')).rejects.toThrow(
      NotFoundException,
    );
  });
});
