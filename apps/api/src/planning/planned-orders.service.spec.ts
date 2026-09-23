import { Test, TestingModule } from '@nestjs/testing';
import { PlannedOrdersService } from './planned-orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { NumberingService } from '../master-data/numbering/numbering.service';
import { PlannedOrderAction, PlannedOrderStatus } from '@prisma/client';

describe('PlannedOrdersService', () => {
  let service: PlannedOrdersService;
  let prisma: any;
  let eventBus: any;

  const mockOrgId = 'org-pln-1';
  const mockUserId = 'user-pln-1';

  beforeEach(async () => {
    prisma = {
      plannedOrder: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBus = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlannedOrdersService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: {} },
      ],
    }).compile();

    service = module.get<PlannedOrdersService>(PlannedOrdersService);
  });

  it('should find planned orders by query filters', async () => {
    prisma.plannedOrder.findMany.mockResolvedValue([
      {
        id: 'ord-1',
        orderNumber: 'PLN-000001',
        action: PlannedOrderAction.PURCHASE,
        status: PlannedOrderStatus.SUGGESTED,
      },
    ]);

    const orders = await service.findAll(mockOrgId, {
      action: PlannedOrderAction.PURCHASE,
    });

    expect(orders).toHaveLength(1);
    expect(orders[0].orderNumber).toBe('PLN-000001');
  });

  it('should update planned order status and publish event', async () => {
    prisma.plannedOrder.findFirst.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'PLN-000001',
      status: PlannedOrderStatus.SUGGESTED,
    });

    prisma.plannedOrder.update.mockResolvedValue({
      id: 'ord-1',
      orderNumber: 'PLN-000001',
      status: PlannedOrderStatus.ACCEPTED,
    });

    const updated = await service.updateStatus(
      mockOrgId,
      'ord-1',
      PlannedOrderStatus.ACCEPTED,
      mockUserId,
    );

    expect(updated.status).toBe(PlannedOrderStatus.ACCEPTED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: 'MRP_PLANNED_ORDER_GENERATED' }),
    );
  });
});
