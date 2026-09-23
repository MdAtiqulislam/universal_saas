import { Test, TestingModule } from '@nestjs/testing';
import { InspectionLotsService } from '../inspections/inspection-lots.service';
import { QualityHoldsService } from '../holds/quality-holds.service';
import { NonConformanceService } from '../ncr/non-conformance.service';
import { CapaService } from '../capa/capa.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { SamplingPlansService } from '../sampling/sampling-plans.service';
import { InspectionDecisionService } from '../inspections/inspection-decision.service';
import { NotFoundException } from '@nestjs/common';

describe('Tenant Quality Isolation', () => {
  let lotsService: InspectionLotsService;
  let holdsService: QualityHoldsService;
  let ncrService: NonConformanceService;
  let capaService: CapaService;
  let prisma: any;

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  beforeEach(async () => {
    prisma = {
      qualityInspectionLot: { findFirst: jest.fn(), findMany: jest.fn() },
      qualityHold: { findFirst: jest.fn(), findMany: jest.fn() },
      nonConformance: { findFirst: jest.fn(), findMany: jest.fn() },
      cAPA: { findFirst: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionLotsService,
        QualityHoldsService,
        NonConformanceService,
        CapaService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
        { provide: NumberingService, useValue: { nextNumber: jest.fn() } },
        { provide: SamplingPlansService, useValue: {} },
        { provide: InspectionDecisionService, useValue: {} },
      ],
    }).compile();

    lotsService = module.get<InspectionLotsService>(InspectionLotsService);
    holdsService = module.get<QualityHoldsService>(QualityHoldsService);
    ncrService = module.get<NonConformanceService>(NonConformanceService);
    capaService = module.get<CapaService>(CapaService);
  });

  it('Tenant B cannot access Tenant A inspection lot', async () => {
    prisma.qualityInspectionLot.findFirst.mockImplementation(
      ({ where }: any) => {
        if (where.organizationId === tenantA && where.id === 'lot-A') {
          return Promise.resolve({ id: 'lot-A', organizationId: tenantA });
        }
        return Promise.resolve(null);
      },
    );

    await expect(lotsService.findOne(tenantB, 'lot-A')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Tenant B cannot access Tenant A quality hold', async () => {
    prisma.qualityHold.findFirst.mockImplementation(({ where }: any) => {
      if (where.organizationId === tenantA && where.id === 'hold-A') {
        return Promise.resolve({ id: 'hold-A', organizationId: tenantA });
      }
      return Promise.resolve(null);
    });

    await expect(holdsService.findOne(tenantB, 'hold-A')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Tenant B cannot access Tenant A NCR', async () => {
    prisma.nonConformance.findFirst.mockImplementation(({ where }: any) => {
      if (where.organizationId === tenantA && where.id === 'ncr-A') {
        return Promise.resolve({ id: 'ncr-A', organizationId: tenantA });
      }
      return Promise.resolve(null);
    });

    await expect(ncrService.findOne(tenantB, 'ncr-A')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('Tenant B cannot access Tenant A CAPA', async () => {
    prisma.cAPA.findFirst.mockImplementation(({ where }: any) => {
      if (where.organizationId === tenantA && where.id === 'capa-A') {
        return Promise.resolve({ id: 'capa-A', organizationId: tenantA });
      }
      return Promise.resolve(null);
    });

    await expect(capaService.findOne(tenantB, 'capa-A')).rejects.toThrow(
      NotFoundException,
    );
  });
});
