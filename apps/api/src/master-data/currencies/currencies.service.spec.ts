import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

describe('CurrenciesService', () => {
  let service: CurrenciesService;
  let prismaMock: any;
  let eventBusMock: any;

  const mockCurrency = {
    id: 'curr-1111',
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prismaMock = {
      currency: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    eventBusMock = {
      publish: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrenciesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: EventBusService, useValue: eventBusMock },
      ],
    }).compile();

    service = module.get<CurrenciesService>(CurrenciesService);
  });

  describe('create', () => {
    it('1. should create a new global currency successfully with uppercase normalization', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(null);
      prismaMock.currency.create.mockResolvedValue({
        ...mockCurrency,
        code: 'EUR',
        name: 'Euro',
      });

      const result = await service.create(
        { code: 'eur', name: 'Euro', symbol: '€', decimalPlaces: 2 },
        'admin-user-id',
      );

      expect(result.code).toBe('EUR');
      expect(prismaMock.currency.create).toHaveBeenCalledWith({
        data: {
          code: 'EUR',
          name: 'Euro',
          symbol: '€',
          decimalPlaces: 2,
          isActive: true,
        },
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'CURRENCY_CREATED',
          code: 'EUR',
        }),
      );
    });

    it('2. should reject duplicate currency code with ConflictException', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(mockCurrency);

      await expect(
        service.create({ code: 'USD', name: 'US Dollar' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne & findAll', () => {
    it('3. should return single currency when exists', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(mockCurrency);

      const result = await service.findOne('curr-1111');
      expect(result.code).toBe('USD');
    });

    it('4. should throw NotFoundException when currency does not exist', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('5. should list currencies with active and search filters', async () => {
      prismaMock.currency.findMany.mockResolvedValue([mockCurrency]);

      const result = await service.findAll({
        isActive: true,
        search: 'Dollar',
      });
      expect(result).toHaveLength(1);
      expect(prismaMock.currency.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            OR: expect.any(Array),
          }),
        }),
      );
    });
  });

  describe('update & deactivate', () => {
    it('6. should update currency details and publish event', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(mockCurrency);
      prismaMock.currency.update.mockResolvedValue({
        ...mockCurrency,
        name: 'United States Dollar',
      });

      const result = await service.update(
        'curr-1111',
        { name: 'United States Dollar' },
        'admin-user-id',
      );

      expect(result.name).toBe('United States Dollar');
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'CURRENCY_UPDATED',
          code: 'USD',
        }),
      );
    });

    it('7. should deactivate currency by setting isActive to false', async () => {
      prismaMock.currency.findUnique.mockResolvedValue(mockCurrency);
      prismaMock.currency.update.mockResolvedValue({
        ...mockCurrency,
        isActive: false,
      });

      const result = await service.deactivate('curr-1111', 'admin-user-id');

      expect(result.success).toBe(true);
      expect(prismaMock.currency.update).toHaveBeenCalledWith({
        where: { id: 'curr-1111' },
        data: { isActive: false },
      });
      expect(eventBusMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'CURRENCY_DEACTIVATED',
          code: 'USD',
        }),
      );
    });
  });
});
