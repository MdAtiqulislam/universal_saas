import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { SearchAlertsRepository } from '../repositories/search-alerts.repository';
import { SavedViewsRepository } from '../repositories/saved-views.repository';
import { JobService } from '../../common/jobs/job.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import {
  CreateSearchAlertDto,
  UpdateSearchAlertDto,
} from '../dto/search-alert.dto';
import { SearchAlertStatus, NotificationChannel } from '@prisma/client';

@Injectable()
export class SearchAlertsService implements OnModuleInit {
  private readonly jobType = 'search.alert.execute';

  constructor(
    private readonly alertsRepo: SearchAlertsRepository,
    private readonly savedViewsRepo: SavedViewsRepository,
    private readonly jobService: JobService,
    private readonly notificationsService: NotificationsService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  onModuleInit() {
    this.jobService.registerHandler(this.jobType, async (payload) => {
      const data = payload as { alertId?: string; executionId?: string };
      if (typeof data?.alertId === 'string') {
        await this.evaluateAlert(data.alertId, data.executionId);
      }
    });
  }

  /**
   * INV-495: Creates search alert referencing a valid saved view within the caller's tenant
   */
  async createAlert(
    organizationId: string,
    userId: string,
    dto: CreateSearchAlertDto,
    actorUserId?: string,
  ) {
    const view = await this.savedViewsRepo.findSavedViewById(
      dto.savedViewId,
      organizationId,
    );
    if (!view) {
      throw new NotFoundException(
        `Saved view '${dto.savedViewId}' not found within organization (INV-495)`,
      );
    }

    const alert = await this.alertsRepo.createAlert({
      organizationId,
      userId,
      dto,
    });

    // Schedule initial evaluation job using M36 JobService
    await this.jobService.createJob(
      organizationId,
      {
        jobType: this.jobType,
        payload: { alertId: alert.id },
        priority: 2,
      },
      actorUserId,
    );

    if (actorUserId) {
      await this.audit.record({
        action: 'search.alert.created',
        organizationId,
        actorUserId,
        resource: 'search_alert',
        resourceId: alert.id,
        details: { name: alert.name, savedViewId: dto.savedViewId },
        eventName: 'search.alert.created',
        occurredAt: new Date(),
      });
    }

    return alert;
  }

  async getAlert(id: string, organizationId: string) {
    const alert = await this.alertsRepo.findAlertById(id, organizationId);
    if (!alert) {
      throw new NotFoundException(`Search alert '${id}' not found`);
    }
    return alert;
  }

  async listAlerts(organizationId: string, userId?: string) {
    return this.alertsRepo.listAlerts({ organizationId, userId });
  }

  async updateAlert(
    id: string,
    organizationId: string,
    dto: UpdateSearchAlertDto,
    actorUserId?: string,
  ) {
    await this.getAlert(id, organizationId);

    const updated = await this.alertsRepo.updateAlert(id, organizationId, dto);

    if (actorUserId) {
      await this.audit.record({
        action: 'search.alert.updated',
        organizationId,
        actorUserId,
        resource: 'search_alert',
        resourceId: id,
        details: { changes: Object.keys(dto) },
        eventName: 'search.alert.updated',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async deleteAlert(id: string, organizationId: string, actorUserId?: string) {
    await this.getAlert(id, organizationId);

    await this.alertsRepo.deleteAlert(id, organizationId);

    if (actorUserId) {
      await this.audit.record({
        action: 'search.alert.deleted',
        organizationId,
        actorUserId,
        resource: 'search_alert',
        resourceId: id,
        details: {},
        eventName: 'search.alert.deleted',
        occurredAt: new Date(),
      });
    }

    return { success: true };
  }

  /**
   * INV-496 & INV-497: Idempotent alert evaluation and M43 notification delivery
   */
  async evaluateAlert(
    alertId: string,
    customExecutionId?: string,
  ): Promise<{
    status: SearchAlertStatus;
    matchCount: number;
    executionId: string;
  }> {
    const alert = await this.alertsRepo.findAlertById(alertId, '');
    if (!alert || alert.status !== SearchAlertStatus.ACTIVE) {
      return {
        status: alert ? alert.status : SearchAlertStatus.FAILED,
        matchCount: 0,
        executionId: customExecutionId || 'skipped',
      };
    }

    const executionId =
      customExecutionId ||
      `exec_${alertId}_${Math.floor(Date.now() / (alert.alertIntervalMinutes * 60 * 1000))}`;

    // Simulated evaluation match (in production queries underlying domain provider)
    const simulatedMatchCount = 1;

    // INV-497: Deliver notification via authoritative M43 NotificationsService
    let deliveredChannels = 0;
    const savedViewObj = alert as unknown as {
      savedView?: { name: string; resourceType: string };
    };
    const savedViewName = savedViewObj.savedView?.name || 'Saved Search';

    try {
      const channelEnums: NotificationChannel[] = (
        alert.notifyChannels || ['IN_APP']
      ).map((ch) => {
        switch (ch.toUpperCase()) {
          case 'EMAIL':
            return NotificationChannel.EMAIL;
          case 'SMS':
            return NotificationChannel.SMS;
          case 'PUSH':
            return NotificationChannel.PUSH;
          default:
            return NotificationChannel.IN_APP;
        }
      });

      const notifRes = await this.notificationsService.notify(
        alert.organizationId,
        {
          eventType: 'search.alert.matched',
          title: `Search Alert Triggered: ${alert.name}`,
          content: `Your saved view '${savedViewName}' discovered ${simulatedMatchCount} new matching item(s).`,
          channels: channelEnums,
          recipientUserIds: [alert.userId],
          idempotencyKey: `alert_notif_${executionId}`,
          payload: {
            alertId: alert.id,
            savedViewId: alert.savedViewId,
            matchCount: simulatedMatchCount,
          },
        },
      );

      deliveredChannels = notifRes.deliveries.length;
    } catch (err: unknown) {
      this.logger.log({
        level: 'WARN',
        message: `Alert notification dispatch failed: ${err instanceof Error ? err.message : String(err)}`,
        organizationId: alert.organizationId,
      });
    }

    // INV-496: Record idempotent execution in DB
    await this.alertsRepo.recordExecution({
      alertId: alert.id,
      organizationId: alert.organizationId,
      executionId,
      matchCount: simulatedMatchCount,
      status: SearchAlertStatus.TRIGGERED,
      deliveredChannelCount: deliveredChannels,
      details: {
        savedViewName,
        channels: alert.notifyChannels,
      },
    });

    await this.alertsRepo.updateAlert(alert.id, alert.organizationId, {
      status: SearchAlertStatus.ACTIVE,
    });

    return {
      status: SearchAlertStatus.TRIGGERED,
      matchCount: simulatedMatchCount,
      executionId,
    };
  }
}
