import { Test, TestingModule } from '@nestjs/testing';
import { WarehouseWavesService } from './warehouse-waves.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { PickWaveStatus } from '@prisma/client';

describe('WarehouseWavesService', () => {
  let service: WarehouseWavesService;
  let prisma: any;
  let eventBus: any;
  let numberingService: any;

  const mockOrgId = 'org-111';

  beforeEach(async () => {
    prisma = {
      location: { findFirst: jest.fn() },
      pickWave: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      pickWaveLine: { create: jest.fn() },
      pickTask: { update: jest.fn() },
    };

    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    numberingService = {
      nextNumber: jest.fn().mockResolvedValue({ formatted: 'WV-000001' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WarehouseWavesService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventBusService, useValue: eventBus },
        { provide: NumberingService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<WarehouseWavesService>(WarehouseWavesService);
  });

  it('should release pick wave successfully', async () => {
    prisma.pickWave.findFirst.mockResolvedValue({
      id: 'wv-1',
      waveNumber: 'WV-000001',
      status: PickWaveStatus.DRAFT,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      pickTasks: [],
    });

    prisma.pickWave.update.mockResolvedValue({
      id: 'wv-1',
      waveNumber: 'WV-000001',
      status: PickWaveStatus.RELEASED,
      warehouse: { id: 'wh-1', code: 'WH1', name: 'Main' },
      pickTasks: [],
    });

    const result = await service.release(mockOrgId, 'wv-1', 'user-1');
    expect(result.status).toBe(PickWaveStatus.RELEASED);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'WAREHOUSE_WAVE_RELEASED',
      }),
    );
  });
});
