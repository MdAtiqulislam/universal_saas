import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotificationDeliveryService } from '../services/notification-delivery.service';
import { DeliveryRepository } from '../repositories/delivery.repository';
import { ChannelRouterService } from '../services/channel-router.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { MetricsService } from '../../operations/metrics/metrics.service';
import { NotificationDeliveryStatus } from '@prisma/client';

describe('NotificationDeliveryService - State Machine (Unit)', () => {
  let service: NotificationDeliveryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationDeliveryService,
        {
          provide: DeliveryRepository,
          useValue: {},
        },
        {
          provide: ChannelRouterService,
          useValue: {},
        },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn() },
        },
        {
          provide: MetricsService,
          useValue: { incrementCounter: jest.fn(), recordHistogram: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationDeliveryService>(
      NotificationDeliveryService,
    );
  });

  describe('validateDeliveryTransition (INV-467, INV-468)', () => {
    it('should allow valid transitions from QUEUED to SENT', () => {
      expect(() => {
        service.validateDeliveryTransition(
          NotificationDeliveryStatus.QUEUED,
          NotificationDeliveryStatus.SENT,
        );
      }).not.toThrow();
    });

    it('should allow valid transitions from SENT to DELIVERED', () => {
      expect(() => {
        service.validateDeliveryTransition(
          NotificationDeliveryStatus.SENT,
          NotificationDeliveryStatus.DELIVERED,
        );
      }).not.toThrow();
    });

    it('should reject transitions from terminal DELIVERED status (INV-468)', () => {
      expect(() => {
        service.validateDeliveryTransition(
          NotificationDeliveryStatus.DELIVERED,
          NotificationDeliveryStatus.QUEUED,
        );
      }).toThrow(BadRequestException);
    });

    it('should reject transitions from terminal BOUNCED status (INV-468)', () => {
      expect(() => {
        service.validateDeliveryTransition(
          NotificationDeliveryStatus.BOUNCED,
          NotificationDeliveryStatus.SENT,
        );
      }).toThrow(BadRequestException);
    });
  });

  describe('calculateBackoffMs', () => {
    it('should return exponential delays bounded by max limit', () => {
      expect(service.calculateBackoffMs(1)).toBe(1000);
      expect(service.calculateBackoffMs(2)).toBe(2000);
      expect(service.calculateBackoffMs(3)).toBe(4000);
      expect(service.calculateBackoffMs(4)).toBe(8000);
      expect(service.calculateBackoffMs(20)).toBe(300000); // capped at 5 minutes
    });
  });
});
