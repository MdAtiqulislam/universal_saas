import { Test, TestingModule } from '@nestjs/testing';
import { ReturnRequestsService } from './requests/return-requests.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { CustomerReturnsService } from './customer/customer-returns.service';
import { SupplierReturnsService } from './supplier/supplier-returns.service';
import { NotFoundException } from '@nestjs/common';

describe('Returns Multi-Tenant Isolation Spec', () => {
  let service: ReturnRequestsService;
  let prisma: PrismaService;

  const tenantA = 'org-aaaa-1111';
  const tenantB = 'org-bbbb-2222';
  const returnIdA = 'rma-aaaa-1111';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnRequestsService,
        {
          provide: PrismaService,
          useValue: {
            returnRequest: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: CustomerReturnsService, useValue: {} },
        { provide: SupplierReturnsService, useValue: {} },
      ],
    }).compile();

    service = module.get<ReturnRequestsService>(ReturnRequestsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should find return request belonging to tenant A', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockImplementation(
      ({ where }) => {
        if (where.organizationId === tenantA && where.id === returnIdA) {
          return Promise.resolve({
            id: returnIdA,
            organizationId: tenantA,
            returnNumber: 'RMA-A001',
            lines: [],
            dispositions: [],
            resolutions: [],
          });
        }
        return Promise.resolve(null);
      },
    );

    const res = await service.findOne(tenantA, returnIdA);
    expect(res.id).toBe(returnIdA);
    expect(res.organizationId).toBe(tenantA);
  });

  it('should block tenant B from accessing tenant A return request (strict isolation)', async () => {
    (prisma.returnRequest.findFirst as jest.Mock).mockImplementation(
      ({ where }) => {
        if (where.organizationId === tenantA && where.id === returnIdA) {
          return Promise.resolve({
            id: returnIdA,
            organizationId: tenantA,
          });
        }
        return Promise.resolve(null);
      },
    );

    await expect(service.findOne(tenantB, returnIdA)).rejects.toThrow(
      NotFoundException,
    );
  });
});
