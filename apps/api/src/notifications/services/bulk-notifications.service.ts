import { Injectable, BadRequestException } from '@nestjs/common';
import {
  NotificationsService,
  SendNotificationResult,
} from './notifications.service';
import { BulkNotificationDto } from '../dto/schedule.dto';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

export interface BulkExecutionResult {
  totalRecipients: number;
  batchesCount: number;
  successfulCount: number;
  failedCount: number;
  notifications: SendNotificationResult[];
}

@Injectable()
export class BulkNotificationsService {
  private readonly defaultBatchSize = 50;
  private readonly maxBatchLimit = 500;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: StructuredLoggingService,
  ) {}

  /**
   * INV-472: Bulk notification processing enforces bounded recipient concurrency.
   * Splits recipients into bounded chunks to prevent event-loop starvation and provider throttling.
   */
  async sendBulk(
    organizationId: string,
    dto: BulkNotificationDto,
    actorUserId?: string,
  ): Promise<BulkExecutionResult> {
    const recipients = dto.recipientIds || [];
    if (recipients.length === 0) {
      throw new BadRequestException(
        'At least one recipient ID is required for bulk sending',
      );
    }

    const batchSize = Math.min(
      this.maxBatchLimit,
      Math.max(1, dto.batchSize || this.defaultBatchSize),
    );

    const chunks: string[][] = [];
    for (let i = 0; i < recipients.length; i += batchSize) {
      chunks.push(recipients.slice(i, i + batchSize));
    }

    this.logger.log({
      level: 'INFO',
      message: `Starting bulk notification dispatch: ${recipients.length} recipients divided into ${chunks.length} batches of max ${batchSize}`,
      organizationId,
      totalRecipients: recipients.length,
      batches: chunks.length,
    });

    const results: SendNotificationResult[] = [];
    let successfulCount = 0;
    let failedCount = 0;

    // Process batches sequentially to guarantee bounded concurrency (INV-472)
    for (let bIndex = 0; bIndex < chunks.length; bIndex++) {
      const batchRecipients = chunks[bIndex];
      try {
        const res = await this.notificationsService.notify(
          organizationId,
          {
            eventType: dto.eventType,
            templateKey: dto.templateKey,
            channels: dto.channels,
            recipientUserIds: batchRecipients,
            title: dto.title,
            content: dto.content,
            payload: dto.payload,
            idempotencyKey: `bulk_${dto.eventType}_${Date.now()}_b${bIndex}`,
          },
          actorUserId,
        );

        results.push(res);
        successfulCount += batchRecipients.length;
      } catch (err: unknown) {
        failedCount += batchRecipients.length;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.log({
          level: 'ERROR',
          message: `Bulk batch ${bIndex + 1}/${chunks.length} failed: ${msg}`,
          organizationId,
          batchIndex: bIndex,
          error: msg,
        });
      }
    }

    return {
      totalRecipients: recipients.length,
      batchesCount: chunks.length,
      successfulCount,
      failedCount,
      notifications: results,
    };
  }
}
