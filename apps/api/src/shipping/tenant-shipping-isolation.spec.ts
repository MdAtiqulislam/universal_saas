import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ShipmentCarriersService } from './carriers/shipment-carriers.service';
import { ShipmentsService } from './shipments/shipments.service';
import { ShipmentTrackingService } from './tracking/shipment-tracking.service';
import { ShipmentReportsService } from './reports/shipment-reports.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { ShipmentStatus, ShipmentTrackingEventType } from '@prisma/client';

describe('Tenant Shipping & Logistics Isolation', () => {
  let carriersService: ShipmentCarriersService;
  let shipmentsService: ShipmentsService;
  let trackingService: ShipmentTrackingService;
  let reportsService: ShipmentReportsService;
  let prismaMock: any;
  let eventBusMock: any;
  let numberingMock: any;

  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const carrierB = '22222222-2222-2222-2222-222222222222';
  const shipmentB = '33333333-3333-3333-3333-333333333333';
  const deliveryOrderB = '44444444-4444-4444-4444-444444444444';
  const userA = 'user-tenant-a';

  beforeEach(async () => {
    prismaMock = {
      $transaction: jest.fn((callback) => callback(prismaMock)),
      shipmentCarrier: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      shipment: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      deliveryOrder: {
        findFirst: jest.fn(),
      },
      shipmentLine: {
        findMany: jest.fn(),
      },
      shipmentTrackingEvent: {
        create: jest.fn(),
      },
      customer: {
        findFirst: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    numberingMock = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'SHP-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShipmentCarriersService,
        ShipmentsService,
        ShipmentTrackingService,
        ShipmentReportsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
        { provide: NumberingService, useValue: numberingMock },
      ],
    }).compile();

    carriersService = module.get<ShipmentCarriersService>(
      ShipmentCarriersService,
    );
    shipmentsService = module.get<ShipmentsService>(ShipmentsService);
    trackingService = module.get<ShipmentTrackingService>(
      ShipmentTrackingService,
    );
    reportsService = module.get<ShipmentReportsService>(ShipmentReportsService);
  });

  it('1. Tenant A cannot find or read Tenant B carrier', async () => {
    prismaMock.shipmentCarrier.findFirst.mockResolvedValue(null);
    await expect(carriersService.findOne(tenantA, carrierB)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.shipmentCarrier.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: carrierB, organizationId: tenantA },
      }),
    );
  });

  it('2. Tenant A carrier list only scopes to Tenant A', async () => {
    prismaMock.shipmentCarrier.findMany.mockResolvedValue([]);
    prismaMock.shipmentCarrier.count.mockResolvedValue(0);

    await carriersService.findAll(tenantA, {});
    expect(prismaMock.shipmentCarrier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });

  it('3. Tenant A cannot create a shipment against Tenant B delivery order', async () => {
    prismaMock.deliveryOrder.findFirst.mockResolvedValue(null);

    await expect(
      shipmentsService.create(
        tenantA,
        { deliveryOrderId: deliveryOrderB },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(prismaMock.deliveryOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: deliveryOrderB, organizationId: tenantA },
      }),
    );
  });

  it('4. Tenant A cannot find or read Tenant B shipment', async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(shipmentsService.findOne(tenantA, shipmentB)).rejects.toThrow(
      NotFoundException,
    );
    expect(prismaMock.shipment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: shipmentB, organizationId: tenantA },
      }),
    );
  });

  it('5. Tenant A shipment list only returns Tenant A shipments', async () => {
    prismaMock.shipment.findMany.mockResolvedValue([]);
    prismaMock.shipment.count.mockResolvedValue(0);

    await shipmentsService.findAll(tenantA, {});
    expect(prismaMock.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });

  it('6. Tenant A cannot dispatch Tenant B shipment', async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(
      shipmentsService.dispatch(tenantA, shipmentB, {}, userA),
    ).rejects.toThrow(NotFoundException);
  });

  it('7. Tenant A cannot confirm delivery of Tenant B shipment', async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(
      shipmentsService.markDelivered(
        tenantA,
        shipmentB,
        undefined,
        undefined,
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('8. Tenant A cannot add tracking event to Tenant B shipment', async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(
      trackingService.addTrackingEvent(
        tenantA,
        shipmentB,
        {
          status: ShipmentStatus.IN_TRANSIT,
          eventType: ShipmentTrackingEventType.IN_TRANSIT,
        },
        userA,
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('9. Tenant A cannot read tracking history of Tenant B shipment', async () => {
    prismaMock.shipment.findFirst.mockResolvedValue(null);
    await expect(
      trackingService.getTrackingHistory(tenantA, shipmentB),
    ).rejects.toThrow(NotFoundException);
  });

  it('10. Tenant A shipment summary report only aggregates Tenant A shipments', async () => {
    prismaMock.shipment.findMany.mockResolvedValue([]);
    await reportsService.getShipmentSummary(tenantA, {});
    expect(prismaMock.shipment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: tenantA }),
      }),
    );
  });
});
