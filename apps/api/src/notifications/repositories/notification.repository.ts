import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, NotificationStatus } from '@prisma/client';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({
      data,
      include: {
        recipients: true,
        template: true,
        templateVersion: true,
      },
    });
  }

  async findNotificationById(id: string, organizationId: string) {
    return this.prisma.notification.findFirst({
      where: { id, organizationId },
      include: {
        recipients: true,
        deliveries: {
          include: {
            attempts: {
              orderBy: { attemptNumber: 'asc' },
            },
          },
        },
        template: true,
        templateVersion: true,
      },
    });
  }

  async findByIdempotencyKey(organizationId: string, idempotencyKey: string) {
    return this.prisma.notification.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId,
          idempotencyKey,
        },
      },
      include: {
        recipients: true,
        deliveries: true,
      },
    });
  }

  async updateNotificationStatus(
    id: string,
    status: NotificationStatus,
    sentAt?: Date,
  ) {
    return this.prisma.notification.update({
      where: { id },
      data: {
        status,
        ...(sentAt ? { sentAt } : {}),
      },
    });
  }

  async listUserNotifications(params: {
    organizationId: string;
    userId: string;
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const {
      organizationId,
      userId,
      unreadOnly,
      limit = 50,
      offset = 0,
    } = params;

    const where: Prisma.NotificationRecipientWhereInput = {
      organizationId,
      userId,
      archivedAt: null,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notificationRecipient.findMany({
        where,
        include: {
          notification: {
            include: {
              template: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationRecipient.count({ where }),
      this.prisma.notificationRecipient.count({
        where: {
          organizationId,
          userId,
          readAt: null,
          archivedAt: null,
        },
      }),
    ]);

    return { items, total, unreadCount };
  }

  async markRecipientRead(recipientId: string, organizationId: string) {
    return this.prisma.notificationRecipient.updateMany({
      where: { id: recipientId, organizationId },
      data: { readAt: new Date() },
    });
  }

  async markAllUserNotificationsRead(organizationId: string, userId: string) {
    return this.prisma.notificationRecipient.updateMany({
      where: {
        organizationId,
        userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }
}
