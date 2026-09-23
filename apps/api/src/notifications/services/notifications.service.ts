import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationRepository } from '../repositories/notification.repository';
import { TemplateRepository } from '../repositories/template.repository';
import { TemplateEngineService } from './template-engine.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import {
  SendNotificationDto,
  QueryNotificationsDto,
} from '../dto/notification.dto';
import {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationDeliveryStatus,
  Prisma,
} from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { MetricsService } from '../../operations/metrics/metrics.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { EntitlementsService } from '../../billing/services/entitlements.service';
import { UsageMeteringService } from '../../billing/services/usage-metering.service';

export interface SendNotificationResult {
  notificationId: string;
  isDuplicate: boolean;
  status: NotificationStatus;
  recipientsCount: number;
  deliveries: {
    channel: NotificationChannel;
    status: NotificationDeliveryStatus;
    recipientId: string;
  }[];
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationRepo: NotificationRepository,
    private readonly templateRepo: TemplateRepository,
    private readonly engine: TemplateEngineService,
    private readonly preferences: NotificationPreferencesService,
    private readonly deliveryService: NotificationDeliveryService,
    private readonly audit: AuditService,
    private readonly metrics: MetricsService,
    private readonly logger: StructuredLoggingService,
    private readonly entitlements: EntitlementsService,
    private readonly usageMetering: UsageMeteringService,
  ) {}

  /**
   * Main notification dispatch entrypoint.
   * Enforces INV-454 (tenant scoped), INV-459 (template or explicit message),
   * INV-469 (idempotency), and M42 commercial quotas.
   */
  async notify(
    organizationId: string,
    dto: SendNotificationDto,
    actorUserId?: string,
  ): Promise<SendNotificationResult> {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is strictly required');
    }

    // INV-469: Duplicate notification idempotency keys cannot create duplicate notifications
    if (dto.idempotencyKey) {
      const existing = await this.notificationRepo.findByIdempotencyKey(
        organizationId,
        dto.idempotencyKey,
      );
      if (existing) {
        this.logger.log({
          level: 'INFO',
          message: `Idempotent notification dispatch skipped for key: ${dto.idempotencyKey}`,
          organizationId,
          idempotencyKey: dto.idempotencyKey,
        });
        return {
          notificationId: existing.id,
          isDuplicate: true,
          status: existing.status,
          recipientsCount: existing.recipients.length,
          deliveries: existing.deliveries.map((d) => ({
            channel: d.channel,
            status: d.status,
            recipientId: d.recipientId,
          })),
        };
      }
    }

    // INV-459: Requires a valid template or an explicit title + content contract
    let templateId: string | undefined;
    let templateVersionId: string | undefined;
    let title = dto.title;
    let content = dto.content;

    if (dto.templateKey) {
      const template = await this.templateRepo.findTemplateByKey(
        organizationId,
        dto.templateKey,
      );
      if (!template) {
        throw new NotFoundException(
          `Notification template '${dto.templateKey}' not found`,
        );
      }
      templateId = template.id;

      const activeVersion = await this.templateRepo.findActiveVersion(
        template.id,
        dto.locale || 'en',
      );
      if (!activeVersion) {
        throw new BadRequestException(
          `Template '${dto.templateKey}' has no published version for locale '${dto.locale || 'en'}'`,
        );
      }
      templateVersionId = activeVersion.id;

      // Safe render using allowlisted template engine
      const renderRes = this.engine.render(
        activeVersion.body,
        dto.payload || {},
        activeVersion.subject || undefined,
        activeVersion.variables,
      );
      title = renderRes.renderedSubject || title || template.name;
      content = renderRes.renderedBody;
    } else {
      // Must have explicit title & content
      if (!content || !title) {
        throw new BadRequestException(
          'Notification creation requires a valid templateKey or explicit title and content',
        );
      }
    }

    // M42 Entitlement Quota Enforcement
    const totalRecipients =
      (dto.recipientUserIds?.length || 0) +
        (dto.recipientDestinations?.length || 0) || 1;

    try {
      await this.entitlements.assertWithinQuota(
        organizationId,
        'notifications.monthly',
        totalRecipients,
      );
    } catch {
      throw new ForbiddenException(
        'Communication quota exceeded for organization: notifications.monthly. Upgrade subscription to proceed.',
      );
    }

    const priority = dto.priority || NotificationPriority.NORMAL;
    const channels = dto.channels || [NotificationChannel.IN_APP];

    // Build notification record in DB
    const notification = await this.prisma.$transaction(async (tx) => {
      const notif = await tx.notification.create({
        data: {
          organizationId,
          templateId,
          templateVersionId,
          eventType: dto.eventType,
          priority,
          status: NotificationStatus.PROCESSING,
          title,
          content,
          payload: (dto.payload || {}) as Prisma.InputJsonValue,
          idempotencyKey: dto.idempotencyKey,
        },
      });

      // Recipients creation
      const recipientCreates: {
        organizationId: string;
        notificationId: string;
        userId?: string;
        destination?: string;
      }[] = [];

      if (dto.recipientUserIds && dto.recipientUserIds.length > 0) {
        for (const uid of dto.recipientUserIds) {
          recipientCreates.push({
            organizationId,
            notificationId: notif.id,
            userId: uid,
          });
        }
      }

      if (dto.recipientDestinations && dto.recipientDestinations.length > 0) {
        for (const dest of dto.recipientDestinations) {
          recipientCreates.push({
            organizationId,
            notificationId: notif.id,
            destination: dest,
          });
        }
      }

      // Default in-app self recipient if none specified
      if (recipientCreates.length === 0) {
        recipientCreates.push({
          organizationId,
          notificationId: notif.id,
          userId: actorUserId,
        });
      }

      const createdRecipients = await Promise.all(
        recipientCreates.map((r) =>
          tx.notificationRecipient.create({ data: r }),
        ),
      );

      return { notif, recipients: createdRecipients };
    });

    const deliveries: {
      channel: NotificationChannel;
      status: NotificationDeliveryStatus;
      recipientId: string;
    }[] = [];

    // Dispatch to channel providers for each recipient
    for (const recipient of notification.recipients) {
      for (const ch of channels) {
        // Evaluate recipient preferences & quiet hours
        if (recipient.userId) {
          const shouldDeliver = await this.preferences.shouldDeliverToRecipient(
            {
              organizationId,
              userId: recipient.userId,
              eventCategory: dto.eventType,
              channel: ch,
              priority,
            },
          );

          if (!shouldDeliver.deliver) {
            this.logger.log({
              level: 'INFO',
              message: `Delivery suppressed for recipient ${recipient.userId} on channel ${ch}: ${shouldDeliver.reason}`,
              organizationId,
              channel: ch,
            });
            continue;
          }
        }

        // Create Delivery Record
        const delivery = await this.prisma.notificationDelivery.create({
          data: {
            organizationId,
            notificationId: notification.notif.id,
            recipientId: recipient.id,
            channel: ch,
            status: NotificationDeliveryStatus.QUEUED,
          },
        });

        // Execute Delivery
        const deliveryResult = await this.deliveryService.executeDelivery({
          deliveryId: delivery.id,
          organizationId,
          notificationId: notification.notif.id,
          recipientId: recipient.id,
          channel: ch,
          destination: recipient.destination || undefined,
          title,
          content,
          metadata: dto.payload,
        });

        deliveries.push({
          channel: ch,
          status: deliveryResult.status,
          recipientId: recipient.id,
        });
      }
    }

    // Mark notification SENT
    await this.notificationRepo.updateNotificationStatus(
      notification.notif.id,
      NotificationStatus.SENT,
      new Date(),
    );

    // M42 Usage Metering record
    void this.usageMetering.recordUsage(organizationId, {
      metricKey: 'notifications.sent',
      quantity: deliveries.length || 1,
      idempotencyKey: dto.idempotencyKey
        ? `${dto.idempotencyKey}:meter`
        : undefined,
    });

    // M38 Observability Metrics
    this.metrics.incrementCounter('notifications.created', {
      eventType: dto.eventType,
      priority,
    });

    // Audit Logging
    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.dispatched',
        organizationId,
        actorUserId,
        resource: 'notification',
        resourceId: notification.notif.id,
        details: {
          eventType: dto.eventType,
          recipientsCount: notification.recipients.length,
          deliveriesCount: deliveries.length,
        },
        eventName: 'notifications.dispatched',
        occurredAt: new Date(),
      });
    }

    return {
      notificationId: notification.notif.id,
      isDuplicate: false,
      status: NotificationStatus.SENT,
      recipientsCount: notification.recipients.length,
      deliveries,
    };
  }

  async notifyUser(
    organizationId: string,
    userId: string,
    dto: SendNotificationDto,
    actorUserId?: string,
  ) {
    return this.notify(
      organizationId,
      {
        ...dto,
        recipientUserIds: [userId],
      },
      actorUserId,
    );
  }

  async notifyUsers(
    organizationId: string,
    userIds: string[],
    dto: SendNotificationDto,
    actorUserId?: string,
  ) {
    return this.notify(
      organizationId,
      {
        ...dto,
        recipientUserIds: userIds,
      },
      actorUserId,
    );
  }

  async notifyOrganization(
    organizationId: string,
    dto: SendNotificationDto,
    actorUserId?: string,
  ) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId, status: 'ACTIVE' },
      select: { userId: true },
    });
    const userIds = members.map((m) => m.userId);
    return this.notifyUsers(organizationId, userIds, dto, actorUserId);
  }

  async getNotification(id: string, organizationId: string) {
    const notif = await this.notificationRepo.findNotificationById(
      id,
      organizationId,
    );
    if (!notif) {
      throw new NotFoundException(`Notification '${id}' not found`);
    }
    // INV-455: Recipient cannot access another tenant's notification
    if (notif.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot access notification of another tenant',
      );
    }
    return notif;
  }

  async listUserNotifications(
    organizationId: string,
    userId: string,
    query: QueryNotificationsDto,
    actorOrgId: string,
  ) {
    // INV-455: Cross-tenant isolation
    if (organizationId !== actorOrgId) {
      throw new ForbiddenException(
        'Cannot query notifications of another tenant',
      );
    }

    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const page = query.page ? parseInt(query.page, 10) : 1;
    const offset = (page - 1) * limit;

    return this.notificationRepo.listUserNotifications({
      organizationId,
      userId,
      unreadOnly: query.status === 'UNREAD',
      limit,
      offset,
    });
  }

  async markRead(recipientId: string, organizationId: string, userId: string) {
    const recipient = await this.prisma.notificationRecipient.findFirst({
      where: { id: recipientId, organizationId },
    });

    if (!recipient) {
      throw new NotFoundException(
        `Notification recipient record '${recipientId}' not found`,
      );
    }

    if (recipient.userId && recipient.userId !== userId) {
      throw new ForbiddenException(
        'Cannot modify read status for another user',
      );
    }

    await this.notificationRepo.markRecipientRead(recipientId, organizationId);
    return { success: true, markedReadAt: new Date() };
  }

  async markAllRead(organizationId: string, userId: string) {
    await this.notificationRepo.markAllUserNotificationsRead(
      organizationId,
      userId,
    );
    return { success: true, markedAllReadAt: new Date() };
  }
}
