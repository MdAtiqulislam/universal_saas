import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { AccountType } from '@prisma/client';

describe('AccountsService', () => {
  let service: AccountsService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockAccountId = '22222222-2222-2222-2222-222222222222';
  const mockParentId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      account: {
        count: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  it('1. should create an account', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);
    prismaMock.account.create.mockResolvedValue({
      id: mockAccountId,
      organizationId: mockOrgId,
      code: '1010',
      name: 'Cash on Hand',
      type: AccountType.ASSET,
      isActive: true,
      isSystem: false,
    });

    const result = await service.create(mockOrgId, {
      code: '1010',
      name: 'Cash on Hand',
      type: AccountType.ASSET,
    });

    expect(result.code).toBe('1010');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ACCOUNT_CREATED',
      }),
    );
  });

  it('2. should reject duplicate account code within tenant', async () => {
    prismaMock.account.findFirst.mockResolvedValue({ id: mockAccountId });

    await expect(
      service.create(mockOrgId, {
        code: '1010',
        name: 'Duplicate Cash',
        type: AccountType.ASSET,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('3. should reject non-existent parent account', async () => {
    prismaMock.account.findFirst
      .mockResolvedValueOnce(null) // code check
      .mockResolvedValueOnce(null); // parent check

    await expect(
      service.create(mockOrgId, {
        code: '1011',
        name: 'Petty Cash',
        type: AccountType.ASSET,
        parentId: 'non-existent-parent',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. should reject self-parenting on update', async () => {
    prismaMock.account.findFirst
      .mockResolvedValueOnce({
        id: mockAccountId,
        code: '1010',
        _count: { journalLines: 0, children: 0 },
      })
      .mockResolvedValueOnce({ id: mockAccountId, organizationId: mockOrgId });

    await expect(
      service.update(mockOrgId, mockAccountId, {
        parentId: mockAccountId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should reject circular hierarchy on update', async () => {
    // Attempting to set parent of Account A to Account B, where Account B's parent is Account A
    prismaMock.account.findFirst
      .mockResolvedValueOnce({
        id: mockAccountId,
        code: '1010',
        _count: { journalLines: 0, children: 0 },
      }) // findOne
      .mockResolvedValueOnce({ id: mockParentId, organizationId: mockOrgId }) // parent exists
      .mockResolvedValueOnce({ parentId: mockAccountId }); // parent has Account A as parent!

    await expect(
      service.update(mockOrgId, mockAccountId, {
        parentId: mockParentId,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('6. should reject soft-deleting system account', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1000',
      name: 'System Asset Account',
      isSystem: true,
      _count: { children: 0, journalLines: 0 },
    });

    await expect(service.softDelete(mockOrgId, mockAccountId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('7. should reject soft-deleting account with active child accounts', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1000',
      isSystem: false,
      _count: { children: 2, journalLines: 0 },
    });

    await expect(service.softDelete(mockOrgId, mockAccountId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('8. should reject soft-deleting account with existing journal lines', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1000',
      isSystem: false,
      _count: { children: 0, journalLines: 5 },
    });

    await expect(service.softDelete(mockOrgId, mockAccountId)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('9. should soft-delete account successfully', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      code: '1010',
      name: 'Old Account',
      isSystem: false,
      _count: { children: 0, journalLines: 0 },
    });
    prismaMock.account.update.mockResolvedValue({});

    const result = await service.softDelete(mockOrgId, mockAccountId);
    expect(result.success).toBe(true);
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'ACCOUNT_DELETED',
      }),
    );
  });
});
