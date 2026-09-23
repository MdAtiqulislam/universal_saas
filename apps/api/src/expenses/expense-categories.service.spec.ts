import { Test, TestingModule } from '@nestjs/testing';
import { ExpenseCategoriesService } from './expense-categories.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ExpenseCategoriesService', () => {
  let service: ExpenseCategoriesService;
  let prisma: any;
  let eventBus: any;

  const orgId = 'org-test-1';
  const userId = 'user-test-1';

  beforeEach(async () => {
    prisma = {
      expenseCategory: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      account: {
        findFirst: jest.fn(),
      },
      taxCode: {
        findFirst: jest.fn(),
      },
      expenseClaimLine: {
        count: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpenseCategoriesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
      ],
    }).compile();

    service = module.get<ExpenseCategoriesService>(ExpenseCategoriesService);
  });

  it('should create an expense category successfully', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    prisma.expenseCategory.create.mockResolvedValue({
      id: 'cat-1',
      organizationId: orgId,
      code: 'TRAVEL',
      name: 'Travel & Lodging',
      isActive: true,
    });

    const result = await service.create(
      orgId,
      {
        code: 'TRAVEL',
        name: 'Travel & Lodging',
      },
      userId,
    );

    expect(result.id).toBe('cat-1');
    expect(result.code).toBe('TRAVEL');
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'EXPENSE_CATEGORY_CREATED',
        organizationId: orgId,
      }),
    );
  });

  it('should reject duplicate category code in the same organization', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: 'cat-existing',
      code: 'TRAVEL',
    });

    await expect(
      service.create(
        orgId,
        {
          code: 'TRAVEL',
          name: 'Travel Duplicate',
        },
        userId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should validate GL account belongs to organization', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    prisma.account.findFirst.mockResolvedValue(null); // Not found

    await expect(
      service.create(
        orgId,
        {
          code: 'MEALS',
          name: 'Meals & Entertainment',
          glAccountId: 'acc-foreign',
        },
        userId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should validate Tax code belongs to organization', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue(null);
    prisma.account.findFirst.mockResolvedValue({ id: 'acc-1' });
    prisma.taxCode.findFirst.mockResolvedValue(null); // Tax code not found

    await expect(
      service.create(
        orgId,
        {
          code: 'MEALS',
          name: 'Meals & Entertainment',
          glAccountId: 'acc-1',
          taxCodeId: 'tax-foreign',
        },
        userId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('should find all categories for tenant', async () => {
    prisma.expenseCategory.findMany.mockResolvedValue([
      { id: 'cat-1', code: 'TRAVEL' },
      { id: 'cat-2', code: 'MEALS' },
    ]);

    const result = await service.findAll(orgId);
    expect(result).toHaveLength(2);
    expect(prisma.expenseCategory.findMany).toHaveBeenCalledWith({
      where: { organizationId: orgId, deletedAt: null },
      include: { glAccount: true, taxCode: true },
      orderBy: { code: 'asc' },
    });
  });

  it('should soft delete if category has referenced lines', async () => {
    prisma.expenseCategory.findFirst.mockResolvedValue({
      id: 'cat-1',
      organizationId: orgId,
    });
    prisma.expenseClaimLine.count.mockResolvedValue(5);
    prisma.expenseCategory.update.mockResolvedValue({
      id: 'cat-1',
      isActive: false,
    });

    await service.delete(orgId, 'cat-1');
    expect(prisma.expenseCategory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cat-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });
});
