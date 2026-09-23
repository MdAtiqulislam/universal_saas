import { Test, TestingModule } from '@nestjs/testing';
import { NumberingService } from './numbering.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('Numbering Concurrency & Atomic Sequence Generation', () => {
  let service: NumberingService;
  let prismaMock: any;

  const mockOrgId = 'org-1111-1111';
  const sequenceKey = 'INVOICE';
  const prefix = 'INV-';
  const padding = 6;

  // In-memory atomic state to simulate PostgreSQL atomic row update under concurrency
  let atomicCounter = 1;
  const lock = {
    locked: false,
    async acquire<T>(fn: () => Promise<T>): Promise<T> {
      while (this.locked) {
        await new Promise((r) => setTimeout(r, 1));
      }
      this.locked = true;
      try {
        return await fn();
      } finally {
        this.locked = false;
      }
    },
  };

  beforeEach(async () => {
    atomicCounter = 1;

    prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => {
        return lock.acquire(async () => {
          const current = atomicCounter++;
          const txMock = {
            $queryRaw: jest.fn().mockResolvedValue([
              {
                allocated_number: current,
                prefix,
                padding,
              },
            ]),
          };
          return (await cb(txMock)) as unknown;
        });
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<NumberingService>(NumberingService);
  });

  it('should safely allocate 100 unique sequence numbers under concurrent simultaneous calls with zero duplicates', async () => {
    const concurrentRequests = 100;

    // Dispatch 100 simultaneous requests
    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      service.nextNumber(mockOrgId, sequenceKey, `user-${i}`),
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(100);

    const numbers = results.map((r) => r.number);
    const formatted = results.map((r) => r.formatted);

    // Verify all 100 numbers are unique
    const uniqueNumbers = new Set(numbers);
    expect(uniqueNumbers.size).toBe(100);

    // Verify formatted values match prefix and padding
    expect(formatted[0]).toBe('INV-000001');
    expect(formatted[99]).toBe('INV-000100');

    // Verify all numbers from 1 to 100 are present
    for (let i = 1; i <= 100; i++) {
      expect(uniqueNumbers.has(i)).toBe(true);
    }
  });
});
