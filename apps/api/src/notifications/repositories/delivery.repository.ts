import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, NotificationDeliveryStatus } from '@prisma/client';

@Injectable()
export class DeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createDelivery(data: Prisma.NotificationDeliveryCreateInput) {
    return this.prisma.notificationDelivery.create({
      data,
    });
  }

  async findDeliveryById(id: string, organizationId: string) {
    return this.prisma.notificationDelivery.findFirst({
      where: { id, organizationId },
      include: {
        attempts: {
          orderBy: { attemptNumber: 'asc' },
        },
        recipient: true,
        notification: true,
      },
    });
  }

  async updateDeliveryStatus(params: {
    deliveryId: string;
    status: NotificationDeliveryStatus;
    error?: string;
    sentAt?: Date;
    deliveredAt?: Date;
    nextRetryAt?: Date;
    incrementAttempt?: boolean;
  }) {
    const {
      deliveryId,
      status,
      error,
      sentAt,
      deliveredAt,
      nextRetryAt,
      incrementAttempt,
    } = params;

    return this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status,
        ...(error !== undefined ? { error } : {}),
        ...(sentAt ? { sentAt } : {}),
        ...(deliveredAt ? { deliveredAt } : {}),
        ...(nextRetryAt !== undefined ? { nextRetryAt } : {}),
        ...(incrementAttempt ? { attemptCount: { increment: 1 } } : {}),
      },
    });
  }

  async recordAttempt(data: Prisma.NotificationDeliveryAttemptCreateInput) {
    return this.prisma.notificationDeliveryAttempt.create({
      data,
    });
  }

  async listDeliveries(params: {
    organizationId: string;
    notificationId?: string;
    status?: NotificationDeliveryStatus;
    limit?: number;
    offset?: number;
  }) {
    const {
      organizationId,
      notificationId,
      status,
      limit = 50,
      offset = 0,
    } = params;

    const where: Prisma.NotificationDeliveryWhereInput = {
      organizationId,
      ...(notificationId ? { notificationId } : {}),
      ...(status ? { status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          recipient: true,
          attempts: {
            orderBy: { attemptNumber: 'desc' },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return { items, total };
  }
}
