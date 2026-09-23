import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { NumberingService } from './numbering.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('NumberingService', () => {
  let service: NumberingService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockOrgId = 'org-1111-1111';
  const mockSeqId = 'seq-2222-2222';

  const mockSequence = {
    id: mockSeqId,
    organizationId: mockOrgId,
    key: 'INVOICE',
    prefix: 'INV-',
    nextNumber: BigInt(42),
    padding: 6,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = {
      numberingSequence: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    eventBusMock = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NumberingService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<NumberingService>(NumberingService);
  });

  describe('create', () => {
    it('1. should create sequence successfully', async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(null);
      prismaMock.numberingSequence.create.mockResolvedValue(mockSequence);

      const result = await service.create(
        mockOrgId,
        { key: 'invoice', prefix: 'INV-', nextNumber: 1, padding: 6 },
        'user-1',
      );

      expect(result.key).toBe('INVOICE');
      expect(prismaMock.numberingSequence.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organizationId: mockOrgId,
          key: 'INVOICE',
          prefix: 'INV-',
          nextNumber: BigInt(1),
          padding: 6,
        }),
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'NUMBERING_SEQUENCE_CREATED',
          organizationId: mockOrgId,
        }),
      );
    });

    it('2. should reject duplicate sequence key within organization', async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(mockSequence);

      await expect(
        service.create(mockOrgId, { key: 'INVOICE' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne & findAll', () => {
    it('3. should return single sequence scoped to organization', async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(mockSequence);

      const result = await service.findOne(mockOrgId, mockSeqId);
      expect(result.id).toBe(mockSeqId);
      expect(prismaMock.numberingSequence.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockSeqId,
          organizationId: mockOrgId,
        },
      });
    });

    it('4. should throw NotFoundException when sequence belongs to another tenant', async () => {
      prismaMock.numberingSequence.findFirst.mockResolvedValue(null);

      await expect(service.findOne('other-org-id', mockSeqId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('nextNumber (Atomic sequence generation)', () => {
    it('5. should generate next number with prefix and padding', async () => {
      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([
          {
            allocated_number: 42,
            prefix: 'INV-',
            padding: 6,
          },
        ]),
      };

      prismaMock.$transaction.mockImplementation((cb: any) => cb(txMock));

      const result = await service.nextNumber(mockOrgId, 'INVOICE', 'user-1');

      expect(result).toEqual({
        sequenceKey: 'INVOICE',
        number: 42,
        formatted: 'INV-000042',
      });

      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'NUMBERING_SEQUENCE_GENERATED',
          organizationId: mockOrgId,
          details: {
            key: 'INVOICE',
            number: 42,
            formatted: 'INV-000042',
          },
        }),
      );
    });

    it('6. should throw NotFoundException when sequence is inactive or does not exist', async () => {
      const txMock = {
        $queryRaw: jest.fn().mockResolvedValue([]), // 0 rows updated
      };

      prismaMock.$transaction.mockImplementation((cb: any) => cb(txMock));

      await expect(
        service.nextNumber(mockOrgId, 'NON_EXISTENT'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
