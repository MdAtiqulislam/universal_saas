import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { NotificationSchedulingService } from '../services/notification-scheduling.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JobService } from '../../common/jobs/job.service';
import { NotificationsService } from '../services/notifications.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { AuditService } from '../../audit/audit.service';
import {
  NotificationChannel,
  NotificationScheduleStatus,
} from '@prisma/client';

describe('NotificationSchedulingService (Unit)', () => {
  let service: NotificationSchedulingService;
  let prismaMock: {
    notificationSchedule: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };
  let jobServiceMock: {
    registerHandler: jest.Mock;
    createJob: jest.Mock;
  };
  let notificationsServiceMock: {
    notify: jest.Mock;
  };

  beforeEach(async () => {
    prismaMock = {
      notificationSchedule: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    jobServiceMock = {
      registerHandler: jest.fn(),
      createJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
    };

    notificationsServiceMock = {
      notify: jest.fn().mockResolvedValue({ notificationId: 'notif-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationSchedulingService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: JobService,
          useValue: jobServiceMock,
        },
        {
          provide: NotificationsService,
          useValue: notificationsServiceMock,
        },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<NotificationSchedulingService>(
      NotificationSchedulingService,
    );
  });

  describe('scheduleNotification (INV-471)', () => {
    it('should reject past timestamps', async () => {
      const pastTime = new Date(Date.now() - 10000).toISOString();
      await expect(
        service.scheduleNotification('org-1', {
          templateKey: 'order_shipped',
          sendAt: pastTime,
          channels: [NotificationChannel.EMAIL],
          recipientIds: ['u1'],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create schedule and enqueue job for future timestamps', async () => {
      const futureTime = new Date(Date.now() + 60000).toISOString();
      prismaMock.notificationSchedule.create.mockResolvedValue({
        id: 'sched-100',
        sendAt: new Date(futureTime),
        status: NotificationScheduleStatus.PENDING,
      });

      const res = await service.scheduleNotification('org-1', {
        templateKey: 'order_shipped',
        sendAt: futureTime,
        channels: [NotificationChannel.EMAIL],
        recipientIds: ['u1'],
      });

      expect(prismaMock.notificationSchedule.create).toHaveBeenCalled();
      expect(jobServiceMock.createJob).toHaveBeenCalled();
      expect(res.id).toBe('sched-100');
    });
  });

  describe('executeScheduledNotification (INV-471, INV-469)', () => {
    it('should atomically update status to EXECUTED and dispatch notification', async () => {
      prismaMock.notificationSchedule.findUnique.mockResolvedValue({
        id: 'sched-100',
        organizationId: 'org-1',
        templateKey: 'welcome_v1',
        channels: [NotificationChannel.EMAIL],
        recipientIds: ['u1'],
        payload: { name: 'Alice' },
        status: NotificationScheduleStatus.PENDING,
      });

      await service.executeScheduledNotification('sched-100');

      expect(prismaMock.notificationSchedule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sched-100' },
          data: expect.objectContaining({
            status: NotificationScheduleStatus.EXECUTED,
          }),
        }),
      );

      expect(notificationsServiceMock.notify).toHaveBeenCalledWith(
        'org-1',
        expect.objectContaining({
          idempotencyKey: 'sched:sched-100',
        }),
      );
    });

    it('should skip duplicate run if schedule is not PENDING', async () => {
      prismaMock.notificationSchedule.findUnique.mockResolvedValue({
        id: 'sched-100',
        organizationId: 'org-1',
        status: NotificationScheduleStatus.EXECUTED,
      });

      await service.executeScheduledNotification('sched-100');

      expect(prismaMock.notificationSchedule.update).not.toHaveBeenCalled();
      expect(notificationsServiceMock.notify).not.toHaveBeenCalled();
    });
  });
});
