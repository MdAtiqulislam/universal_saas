import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyService } from './idempotency.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException } from '@nestjs/common';

describe('IdempotencyService (Milestone M36)', () => {
  let service: IdempotencyService;
  let prisma: any;

  const mockOrgId = 'org-idempotency-1';
  const mockKey = 'idem-req-001';
  const mockAction = 'payment_capture';

  beforeEach(async () => {
    prisma = {
      idempotencyRecord: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  it('should start a new idempotency record and return isReplay: false', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue(null);
    prisma.idempotencyRecord.create.mockResolvedValue({ id: 'rec-1' });

    const res = await service.start(mockOrgId, mockKey, mockAction, {
      amount: 500,
    });
    expect(res.isReplay).toBe(false);
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          idempotencyKey: mockKey,
          status: 'PENDING',
        }),
      }),
    );
  });

  it('should return cached response for COMPLETED record on replay', async () => {
    const cachedResponse = { paymentId: 'pay-123', status: 'SUCCESS' };
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      status: 'COMPLETED',
      action: mockAction,
      requestHash: '',
      statusCode: 201,
      responseBody: cachedResponse,
      expiresAt: new Date(Date.now() + 100000),
    });

    const res = await service.start(mockOrgId, mockKey, mockAction);
    expect(res.isReplay).toBe(true);
    expect(res.statusCode).toBe(201);
    expect(res.responseBody).toEqual(cachedResponse);
  });

  it('should throw ConflictException if operation with key is currently PENDING', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      status: 'PENDING',
      action: mockAction,
      requestHash: '',
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(service.start(mockOrgId, mockKey, mockAction)).rejects.toThrow(
      ConflictException,
    );
  });

  it('rejects replay when the same key is used for a different action or payload', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      status: 'COMPLETED',
      action: 'different_action',
      requestHash: 'different_hash',
      statusCode: 200,
      responseBody: { unsafe: true },
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(
      service.start(mockOrgId, mockKey, mockAction, { changed: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects a failed key reused for a different action or payload', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'rec-1',
      status: 'FAILED',
      action: 'different_action',
      requestHash: 'different_hash',
      responseBody: { error: 'failed' },
      expiresAt: new Date(Date.now() + 100000),
    });

    await expect(
      service.start(mockOrgId, mockKey, mockAction, { changed: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('replaces an expired record instead of updating the deleted record', async () => {
    prisma.idempotencyRecord.findUnique.mockResolvedValue({
      id: 'expired-1',
      status: 'COMPLETED',
      action: mockAction,
      requestHash: '',
      expiresAt: new Date(Date.now() - 100000),
    });
    prisma.idempotencyRecord.delete.mockResolvedValue({ id: 'expired-1' });
    prisma.idempotencyRecord.create.mockResolvedValue({ id: 'new-1' });

    await expect(service.start(mockOrgId, mockKey, mockAction)).resolves.toEqual({
      isReplay: false,
    });
    expect(prisma.idempotencyRecord.create).toHaveBeenCalled();
    expect(prisma.idempotencyRecord.update).not.toHaveBeenCalled();
  });

  it('should complete idempotency record with status code and body', async () => {
    await service.complete(
      mockOrgId,
      mockKey,
      200,
      { success: true },
      'payment',
      'pay-1',
    );
    expect(prisma.idempotencyRecord.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: mockOrgId, idempotencyKey: mockKey },
        data: expect.objectContaining({
          status: 'COMPLETED',
          statusCode: 200,
          resource: 'payment',
          resourceId: 'pay-1',
        }),
      }),
    );
  });
});
