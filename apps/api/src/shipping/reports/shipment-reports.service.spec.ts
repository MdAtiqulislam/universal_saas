import { Test, TestingModule } from '@nestjs/testing';
import { ShipmentReportsService } from './shipment-reports.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ShipmentStatus, Prisma } from '@prisma/client';

describe('ShipmentReportsService', () => {
  let service: ShipmentReportsService;
  let prismaMock: any;

  const mockOrgId = '11111111-1111-1111-1111-111111111111';

  beforeEach(async () => {
    prismaMock = {
      shipment: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
      shipmentCarrier: {
        findMany: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentReportsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<ShipmentReportsService>(ShipmentReportsService);
  });

  describe('getShipmentSummary', () => {
    it('should compute total shipments, status counts, logistics costs, and on-time delivery rate', async () => {
      const now = new Date();
      prismaMock.shipment.findMany.mockResolvedValue([
        {
          status: ShipmentStatus.DELIVERED,
          shippingCost: new Prisma.Decimal(100),
          insuranceCost: new Prisma.Decimal(20),
          otherCost: new Prisma.Decimal(10),
          totalLogisticsCost: new Prisma.Decimal(130),
          estimatedDeliveryDate: new Date(now.getTime() + 10000),
          actualDeliveryDate: now,
        },
        {
          status: ShipmentStatus.IN_TRANSIT,
          shippingCost: new Prisma.Decimal(50),
          insuranceCost: new Prisma.Decimal(10),
          otherCost: new Prisma.Decimal(0),
          totalLogisticsCost: new Prisma.Decimal(60),
          estimatedDeliveryDate: null,
          actualDeliveryDate: null,
        },
      ]);

      const summary = await service.getShipmentSummary(mockOrgId, {});
      expect(summary.totalShipments).toBe(2);
      expect(summary.deliveredCount).toBe(1);
      expect(summary.inTransitCount).toBe(1);
      expect(summary.totalLogisticsCost).toBe('190.0000');
      expect(summary.onTimeDeliveryRate).toBe(100);
    });
  });

  describe('getOpenShipments', () => {
    it('should list open shipments pending completion', async () => {
      prismaMock.shipment.findMany.mockResolvedValue([
        {
          id: 's1',
          shipmentNumber: 'SHP-001',
          status: ShipmentStatus.IN_TRANSIT,
        },
      ]);
      prismaMock.shipment.count.mockResolvedValue(1);

      const result = await service.getOpenShipments(mockOrgId, {});
      expect(result.shipments).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('getShipmentPerformance', () => {
    it('should calculate on-time rate and average transit duration', async () => {
      const shipDate = new Date('2026-08-20T10:00:00Z');
      const estDate = new Date('2026-08-23T10:00:00Z');
      const delDate = new Date('2026-08-22T10:00:00Z');

      prismaMock.shipment.findMany.mockResolvedValue([
        {
          id: 'shp-1',
          shipmentNumber: 'SHP-000001',
          status: ShipmentStatus.DELIVERED,
          actualShipDate: shipDate,
          estimatedDeliveryDate: estDate,
          actualDeliveryDate: delDate,
          customer: { name: 'Acme Corp' },
          carrier: { name: 'DHL' },
        },
      ]);

      const perf = await service.getShipmentPerformance(mockOrgId, {});
      expect(perf.totalDelivered).toBe(1);
      expect(perf.onTimeDeliveries).toBe(1);
      expect(perf.onTimeRate).toBe(100);
      expect(perf.avgDeliveryDays).toBe(2);
    });
  });

  describe('getCarrierPerformance', () => {
    it('should breakdown delivery metrics by carrier', async () => {
      prismaMock.shipmentCarrier.findMany.mockResolvedValue([
        {
          id: 'c1',
          code: 'DHL',
          name: 'DHL Express',
          carrierType: 'COURIER',
          shipments: [
            {
              status: ShipmentStatus.DELIVERED,
              totalLogisticsCost: new Prisma.Decimal(150),
              actualShipDate: new Date('2026-08-20'),
              actualDeliveryDate: new Date('2026-08-22'),
              estimatedDeliveryDate: new Date('2026-08-23'),
            },
          ],
        },
      ]);

      const result = await service.getCarrierPerformance(mockOrgId, {});
      expect(result).toHaveLength(1);
      expect(result[0].carrierCode).toBe('DHL');
      expect(result[0].deliveredCount).toBe(1);
      expect(result[0].onTimeRate).toBe(100);
      expect(result[0].totalCost).toBe('150.0000');
    });
  });

  describe('getTrackingExceptions', () => {
    it('should find failed, returned, and overdue shipments', async () => {
      prismaMock.shipment.findMany.mockResolvedValue([
        { id: 's1', status: ShipmentStatus.FAILED },
        { id: 's2', status: ShipmentStatus.RETURNED },
      ]);

      const result = await service.getTrackingExceptions(mockOrgId, {});
      expect(result.failedCount).toBe(1);
      expect(result.returnedCount).toBe(1);
      expect(result.totalExceptions).toBe(2);
    });
  });
});
