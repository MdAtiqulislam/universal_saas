import { ForbiddenException } from '@nestjs/common';
import { DataOperationQuotaService } from '../services/data-operation-quota.service';
import { DataOperationNotificationService } from '../services/data-operation-notification.service';
import { DataOperationType, NotificationChannel } from '@prisma/client';

describe('DataOperationSecurity & Integration', () => {
  let mockPrisma: any;
  let mockEntitlements: any;
  let mockNotifications: any;
  let quotaService: DataOperationQuotaService;
  let notificationService: DataOperationNotificationService;

  beforeEach(() => {
    mockPrisma = {
      $transaction: jest.fn().mockImplementation(async (callback) => callback(mockPrisma)),
      dataOperationJob: {
        count: jest.fn().mockResolvedValue(0),
      },
    };

    mockEntitlements = {
      assertWithinQuota: jest.fn().mockResolvedValue(undefined),
    };

    mockNotifications = {
      notify: jest.fn().mockResolvedValue({ notificationId: 'notif-1' }),
    };

    quotaService = new DataOperationQuotaService(mockPrisma, mockEntitlements);
    notificationService = new DataOperationNotificationService(
      mockNotifications,
    );
  });

  // INV-546: Quota enforcement through M42
  it('INV-546: should check monthly operation and row volume quotas via EntitlementsService', async () => {
    await quotaService.assertQuota('org-1', DataOperationType.EXPORT, 500);

    expect(mockEntitlements.assertWithinQuota).toHaveBeenCalledWith(
      'org-1',
      'data_operations.exports.monthly',
      1,
    );
    expect(mockEntitlements.assertWithinQuota).toHaveBeenCalledWith(
      'org-1',
      'data_operations.rows.limit',
      500,
    );
  });

  it('INV-546: should reject operation when concurrent active jobs limit is exceeded', async () => {
    mockPrisma.dataOperationJob.count.mockResolvedValue(3); // MAX_CONCURRENT_DATA_JOBS is 3

    await expect(
      quotaService.assertQuota('org-1', DataOperationType.IMPORT, 100),
    ).rejects.toThrow(ForbiddenException);
  });

  it('INV-546: five concurrent admissions authorize no more than three jobs', async () => {
    let activeJobs = 0;
    let authorizedJobs = 0;
    let transactionTail = Promise.resolve();
    mockPrisma.$transaction.mockImplementation(
      (callback: (tx: any) => Promise<unknown>) => {
        const result = transactionTail.then(() => callback(mockPrisma));
        transactionTail = result.then(
          () => undefined,
          () => undefined,
        );
        return result;
      },
    );
    mockPrisma.dataOperationJob.count.mockImplementation(async () => activeJobs);

    const requests = Array.from({ length: 5 }, () =>
      quotaService.withConcurrentSlot('org-1', async () => {
        authorizedJobs++;
        activeJobs++;
        await Promise.resolve();
        return authorizedJobs;
      }),
    );
    const results = await Promise.allSettled(requests);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(3);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(2);
    expect(authorizedJobs).toBe(3);
  });

  // INV-547: Notifications via M43
  it('INV-547: should dispatch completion notifications through M43 NotificationsService', async () => {
    const job: any = {
      id: 'job-1',
      organizationId: 'org-1',
      createdById: 'user-1',
      operationKey: 'crm.customer.export',
      operationType: DataOperationType.EXPORT,
      processedRows: 100,
      successfulRows: 100,
      failedRows: 0,
    };

    await notificationService.notifyJobCompletion(job);

    expect(mockNotifications.notify).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        eventType: 'data_operations.job.completed',
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        recipientUserIds: ['user-1'],
      }),
    );
  });

  it('INV-547: should dispatch failure notifications through M43 NotificationsService', async () => {
    const job: any = {
      id: 'job-1',
      organizationId: 'org-1',
      createdById: 'user-1',
      operationKey: 'crm.customer.import',
      operationType: DataOperationType.IMPORT,
    };

    await notificationService.notifyJobFailure(
      job,
      'Database connection timeout',
    );

    expect(mockNotifications.notify).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({
        eventType: 'data_operations.job.failed',
        recipientUserIds: ['user-1'],
      }),
    );
  });
});
