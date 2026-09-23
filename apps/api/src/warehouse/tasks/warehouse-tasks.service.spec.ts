import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseTasksService } from './warehouse-tasks.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { WarehouseTaskType, WarehouseTaskStatus } from '@prisma/client';

describe('WarehouseTasksService', () => {
  let service: WarehouseTasksService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      warehouseTask: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'WT-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseTasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<WarehouseTasksService>(WarehouseTasksService);
  });

  it('should create and assign warehouse task correctly', async () => {
    prisma.location.findFirst.mockResolvedValue({
      id: 'wh-1',
      organizationId: mockOrgId,
    });
    prisma.warehouseTask.create.mockResolvedValue({
      id: 'task-1',
      taskNumber: 'WT-000001',
      taskType: WarehouseTaskType.PUTAWAY,
      status: WarehouseTaskStatus.ASSIGNED,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main WH' },
    });

    const result = await service.create(mockOrgId, {
      warehouseId: 'wh-1',
      taskType: WarehouseTaskType.PUTAWAY,
      assignedUserId: 'user-123',
    });

    expect(result.taskNumber).toBe('WT-000001');
    expect(result.status).toBe(WarehouseTaskStatus.ASSIGNED);
  });
});
