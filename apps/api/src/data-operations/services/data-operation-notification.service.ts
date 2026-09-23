import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationChannel } from '@prisma/client';
import { DataOperationJob } from '@prisma/client';

/**
 * INV-547: Data operation notifications use M43 communication policies and cannot bypass them.
 */
@Injectable()
export class DataOperationNotificationService {
  private readonly logger = new Logger(DataOperationNotificationService.name);

  constructor(private readonly notifications: NotificationsService) {}

  async notifyJobCompletion(job: DataOperationJob): Promise<void> {
    if (!job.createdById) {
      return;
    }

    try {
      await this.notifications.notify(job.organizationId, {
        eventType: 'data_operations.job.completed',
        title: `Data ${job.operationType.toLowerCase()} completed: ${job.operationKey}`,
        content: `Your data ${job.operationType.toLowerCase()} job has completed successfully. Total processed: ${job.processedRows} rows, Successful: ${job.successfulRows} rows, Failed: ${job.failedRows} rows.`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        recipientUserIds: [job.createdById],
        payload: {
          jobId: job.id,
          operationKey: job.operationKey,
          operationType: job.operationType,
          totalRows: job.totalRows,
          successfulRows: job.successfulRows,
          failedRows: job.failedRows,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to deliver data operation completion notification for job ${job.id}: ${msg}`,
      );
    }
  }

  async notifyJobFailure(job: DataOperationJob, error: string): Promise<void> {
    if (!job.createdById) {
      return;
    }

    try {
      await this.notifications.notify(job.organizationId, {
        eventType: 'data_operations.job.failed',
        title: `Data ${job.operationType.toLowerCase()} failed: ${job.operationKey}`,
        content: `Your data ${job.operationType.toLowerCase()} job failed. Error: ${error.slice(0, 200)}`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        recipientUserIds: [job.createdById],
        payload: {
          jobId: job.id,
          operationKey: job.operationKey,
          operationType: job.operationType,
          error,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to deliver data operation failure notification for job ${job.id}: ${msg}`,
      );
    }
  }
}
