import { Test, TestingModule } from '@nestjs/testing';
import { ApAccountMappingService } from './ap-account-mapping.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AccountType } from '@prisma/client';

describe('ApAccountMappingService', () => {
  let service: ApAccountMappingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';
  const mockAccountId = '22222222-2222-2222-2222-222222222222';
  const mockUserId = '33333333-3333-3333-3333-333333333333';

  beforeEach(async () => {
    prismaMock = {
      account: {
        findFirst: jest.fn(),
      },
      accountingAccountMapping: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApAccountMappingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<ApAccountMappingService>(ApAccountMappingService);
  });

  it('1. should successfully upsert mapping for valid supported key and active account', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      organizationId: mockOrgId,
      code: '2010',
      name: 'Accounts Payable',
      type: AccountType.LIABILITY,
      isActive: true,
      deletedAt: null,
    });

    prismaMock.accountingAccountMapping.upsert.mockResolvedValue({
      id: 'mapping-1',
      organizationId: mockOrgId,
      key: 'ACCOUNTS_PAYABLE',
      accountId: mockAccountId,
      account: {
        id: mockAccountId,
        code: '2010',
        name: 'Accounts Payable',
        type: AccountType.LIABILITY,
        isActive: true,
      },
    });

    const result = await service.upsertMapping(
      mockOrgId,
      'ACCOUNTS_PAYABLE',
      mockAccountId,
      mockUserId,
    );

    expect(result.key).toBe('ACCOUNTS_PAYABLE');
    expect(result.account.code).toBe('2010');
    expect(eventBusMock.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'AP_ACCOUNT_MAPPING_UPDATED',
      }),
    );
  });

  it('2. should reject unsupported account mapping key', async () => {
    await expect(
      service.upsertMapping(
        mockOrgId,
        'INVALID_KEY',
        mockAccountId,
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('3. should reject when account is not found in organization', async () => {
    prismaMock.account.findFirst.mockResolvedValue(null);

    await expect(
      service.upsertMapping(
        mockOrgId,
        'ACCOUNTS_PAYABLE',
        mockAccountId,
        mockUserId,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('4. should reject when target account is inactive', async () => {
    prismaMock.account.findFirst.mockResolvedValue({
      id: mockAccountId,
      organizationId: mockOrgId,
      code: '2010',
      name: 'Accounts Payable',
      isActive: false,
      deletedAt: null,
    });

    await expect(
      service.upsertMapping(
        mockOrgId,
        'ACCOUNTS_PAYABLE',
        mockAccountId,
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('5. should retrieve all mappings configured for organization', async () => {
    prismaMock.accountingAccountMapping.findMany.mockResolvedValue([
      {
        id: 'm-1',
        organizationId: mockOrgId,
        key: 'ACCOUNTS_PAYABLE',
        accountId: mockAccountId,
        account: {
          id: mockAccountId,
          code: '2010',
          name: 'AP',
          isActive: true,
        },
      },
    ]);

    const results = await service.findAll(mockOrgId);
    expect(results).toHaveLength(1);
    expect(results[0].key).toBe('ACCOUNTS_PAYABLE');
  });

  it('6. should resolve account ID for GL posting when configured and active', async () => {
    prismaMock.accountingAccountMapping.findUnique.mockResolvedValue({
      id: 'm-1',
      organizationId: mockOrgId,
      key: 'ACCOUNTS_PAYABLE',
      accountId: mockAccountId,
      account: {
        id: mockAccountId,
        code: '2010',
        name: 'AP',
        isActive: true,
        deletedAt: null,
      },
    });

    const accountId = await service.resolveAccount(
      mockOrgId,
      'ACCOUNTS_PAYABLE',
    );
    expect(accountId).toBe(mockAccountId);
  });

  it('7. should throw BadRequestException when required mapping is missing', async () => {
    prismaMock.accountingAccountMapping.findUnique.mockResolvedValue(null);

    await expect(
      service.resolveAccount(mockOrgId, 'ACCOUNTS_PAYABLE'),
    ).rejects.toThrow(BadRequestException);
  });
});
