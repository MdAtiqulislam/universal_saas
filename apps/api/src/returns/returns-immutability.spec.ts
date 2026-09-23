import { Test, TestingModule } from '@nestjs/testing';
import { ReturnRequestsService } from './requests/return-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CustomerReturnsService } from './customer/customer-returns.service';
import { SupplierReturnsService } from './supplier/supplier-returns.service';
import { ReturnStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('Returns Immutability & Closure Spec', () => {
  let service: ReturnRequestsService;
  let prisma: PrismaService;
  let eventBus: EventBusService;

  const mockOrgId = 'org-111';
  const mockUserId = 'user-111';
  const mockReturnId = 'rma-111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRequestsService,
        {
          provide: PrismaService,
          useValue: {
            returnRequest: { findFirst: jest.fn(), update: jest.fn() },
          },
        },
        {
          provide: EventBusService,
          useValue: { publish: jest.fn().mockResolvedValue(undefined) },
        },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: CustomerReturnsService, useValue: {} },
        { provide: SupplierReturnsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ReturnRequestsService>(ReturnRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
    eventBus = module.get<EventBusService>(EventBusService);
  });

  it('should close RMA and set isImmutable to true', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      organizationId: mockOrgId,
      status: ReturnStatus.RESOLVED,
      returnNumber: 'RMA-000001',
      isImmutable: false,
      lines: [],
      dispositions: [],
      resolutions: [],
    });

    (prisma.returnRequest.update as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      status: ReturnStatus.CLOSED,
      isImmutable: true,
      returnNumber: 'RMA-000001',
      lines: [],
      dispositions: [],
      resolutions: [],
    });

    const res = await service.close(mockOrgId, mockReturnId, mockUserId);

    expect(res.status).toBe(ReturnStatus.CLOSED);
    expect(res.isImmutable).toBe(true);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'RETURN_CLOSED',
        organizationId: mockOrgId,
      }),
    );
  });

  it('should prevent updating closed or immutable returns', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockResolvedValue({
      id: mockReturnId,
      organizationId: mockOrgId,
      status: ReturnStatus.CLOSED,
      isImmutable: true,
      lines: [],
      dispositions: [],
      resolutions: [],
    });

    await expect(
      service.update(
        mockOrgId,
        mockReturnId,
        { notes: 'New notes' },
        mockUserId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
