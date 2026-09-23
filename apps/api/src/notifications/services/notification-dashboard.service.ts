import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  NotificationDeliveryStatus,
  NotificationTemplateStatus,
} from '@prisma/client';

export interface NotificationKpiSummary {
  totalSent: number;
  deliverySuccessRate: number;
  deliveryFailureRate: number;
  queuedCount: number;
  activeTemplates: number;
  unreadInApp: number;
  registeredDevices: number;
  providerHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
}

@Injectable()
export class NotificationDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(organizationId: string): Promise<{
    kpis: NotificationKpiSummary;
    recentNotifications: unknown[];
    activeSchedulesCount: number;
  }> {
    const [
      totalDeliveries,
      deliveredCount,
      failedCount,
      queuedCount,
      activeTemplates,
      unreadInApp,
      registeredDevices,
      recentNotifs,
      activeSchedulesCount,
    ] = await Promise.all([
      this.prisma.notificationDelivery.count({ where: { organizationId } }),
      this.prisma.notificationDelivery.count({
        where: { organizationId, status: NotificationDeliveryStatus.DELIVERED },
      }),
      this.prisma.notificationDelivery.count({
        where: {
          organizationId,
          status: {
            in: [
              NotificationDeliveryStatus.FAILED,
              NotificationDeliveryStatus.REJECTED,
            ],
          },
        },
      }),
      this.prisma.notificationDelivery.count({
        where: { organizationId, status: NotificationDeliveryStatus.QUEUED },
      }),
      this.prisma.notificationTemplate.count({
        where: {
          OR: [{ organizationId }, { organizationId: null }],
          status: NotificationTemplateStatus.PUBLISHED,
        },
      }),
      this.prisma.notificationRecipient.count({
        where: { organizationId, readAt: null, archivedAt: null },
      }),
      this.prisma.pushDevice.count({
        where: { organizationId, isActive: true },
      }),
      this.prisma.notification.findMany({
        where: { organizationId },
        include: {
          template: true,
          recipients: { take: 5 },
          deliveries: { take: 5 },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.notificationSchedule.count({
        where: { organizationId, status: 'PENDING' },
      }),
    ]);

    const deliverySuccessRate =
      totalDeliveries > 0
        ? Math.round((deliveredCount / totalDeliveries) * 10000) / 100
        : 100;
    const deliveryFailureRate =
      totalDeliveries > 0
        ? Math.round((failedCount / totalDeliveries) * 10000) / 100
        : 0;

    return {
      kpis: {
        totalSent: totalDeliveries,
        deliverySuccessRate,
        deliveryFailureRate,
        queuedCount,
        activeTemplates,
        unreadInApp,
        registeredDevices,
        providerHealth: deliveryFailureRate > 20 ? 'DEGRADED' : 'HEALTHY',
      },
      recentNotifications: recentNotifs,
      activeSchedulesCount,
    };
  }
}
