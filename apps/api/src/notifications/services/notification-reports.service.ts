import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationDeliveryStatus } from '@prisma/client';

@Injectable()
export class NotificationReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Notification Volume Report
  async getNotificationVolumeReport(organizationId: string) {
    const total = await this.prisma.notification.count({
      where: { organizationId },
    });
    const byPriority = await this.prisma.notification.groupBy({
      by: ['priority'],
      where: { organizationId },
      _count: { id: true },
    });
    return {
      organizationId,
      totalNotifications: total,
      breakdownByPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.id,
      })),
    };
  }

  // 2. Delivery Success Rate Report
  async getDeliverySuccessRateReport(organizationId: string) {
    const total = await this.prisma.notificationDelivery.count({
      where: { organizationId },
    });
    const delivered = await this.prisma.notificationDelivery.count({
      where: { organizationId, status: NotificationDeliveryStatus.DELIVERED },
    });
    const successRate =
      total > 0 ? Math.round((delivered / total) * 10000) / 100 : 100;
    return {
      organizationId,
      totalDeliveries: total,
      deliveredCount: delivered,
      successRatePercentage: successRate,
    };
  }

  // 3. Delivery Failure Rate Report
  async getDeliveryFailureRateReport(organizationId: string) {
    const total = await this.prisma.notificationDelivery.count({
      where: { organizationId },
    });
    const failed = await this.prisma.notificationDelivery.count({
      where: {
        organizationId,
        status: {
          in: [
            NotificationDeliveryStatus.FAILED,
            NotificationDeliveryStatus.REJECTED,
          ],
        },
      },
    });
    const failureRate =
      total > 0 ? Math.round((failed / total) * 10000) / 100 : 0;
    return {
      organizationId,
      totalDeliveries: total,
      failedCount: failed,
      failureRatePercentage: failureRate,
    };
  }

  // 4. Channel Distribution Report
  async getChannelDistributionReport(organizationId: string) {
    const grouped = await this.prisma.notificationDelivery.groupBy({
      by: ['channel'],
      where: { organizationId },
      _count: { id: true },
    });
    const total = grouped.reduce((sum, g) => sum + g._count.id, 0);
    return {
      organizationId,
      totalDeliveries: total,
      channels: grouped.map((g) => ({
        channel: g.channel,
        count: g._count.id,
        percentage:
          total > 0 ? Math.round((g._count.id / total) * 10000) / 100 : 0,
      })),
    };
  }

  // 5. Provider Performance Report
  async getProviderPerformanceReport(organizationId: string) {
    const attempts = await this.prisma.notificationDeliveryAttempt.findMany({
      where: {
        delivery: { organizationId },
      },
      select: {
        providerKey: true,
        durationMs: true,
        status: true,
      },
      take: 1000,
    });

    const providerMap = new Map<
      string,
      { total: number; success: number; totalDuration: number }
    >();
    for (const a of attempts) {
      const entry = providerMap.get(a.providerKey) || {
        total: 0,
        success: 0,
        totalDuration: 0,
      };
      entry.total++;
      if (a.status === NotificationDeliveryStatus.DELIVERED) {
        entry.success++;
      }
      entry.totalDuration += a.durationMs || 0;
      providerMap.set(a.providerKey, entry);
    }

    const providers = Array.from(providerMap.entries()).map(([key, data]) => ({
      providerKey: key,
      totalAttempts: data.total,
      successRate: Math.round((data.success / data.total) * 10000) / 100,
      avgDurationMs: Math.round(data.totalDuration / data.total),
    }));

    return { organizationId, providers };
  }

  // 6. Bounce Report
  async getBounceReport(organizationId: string) {
    const bounced = await this.prisma.notificationDelivery.findMany({
      where: {
        organizationId,
        status: NotificationDeliveryStatus.BOUNCED,
      },
      include: {
        recipient: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      organizationId,
      bouncedCount: bounced.length,
      bounces: bounced.map((b) => ({
        deliveryId: b.id,
        channel: b.channel,
        destination: b.recipient.destination,
        error: b.error,
        occurredAt: b.updatedAt,
      })),
    };
  }

  // 7. Notification Preference Adoption Report
  async getPreferenceAdoptionReport(organizationId: string) {
    const totalMembers = await this.prisma.organizationMember.count({
      where: { organizationId, status: 'ACTIVE' },
    });
    const usersWithCustomPreferences =
      await this.prisma.notificationPreference.groupBy({
        by: ['userId'],
        where: { organizationId },
      });

    const quietHoursUsers = await this.prisma.notificationPreference.count({
      where: {
        organizationId,
        quietHoursStart: { not: null },
      },
    });

    return {
      organizationId,
      totalActiveMembers: totalMembers,
      membersConfiguredPreferences: usersWithCustomPreferences.length,
      adoptionRatePercentage:
        totalMembers > 0
          ? Math.round(
              (usersWithCustomPreferences.length / totalMembers) * 10000,
            ) / 100
          : 0,
      quietHoursActiveCount: quietHoursUsers,
    };
  }

  // 8. Scheduled Notification Report
  async getScheduledNotificationReport(organizationId: string) {
    const grouped = await this.prisma.notificationSchedule.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { id: true },
    });
    return {
      organizationId,
      schedules: grouped.map((g) => ({
        status: g.status,
        count: g._count.id,
      })),
    };
  }

  // 9. Retry & Failure Analysis Report
  async getRetryFailureAnalysisReport(organizationId: string) {
    const deliveries = await this.prisma.notificationDelivery.groupBy({
      by: ['attemptCount', 'status'],
      where: { organizationId },
      _count: { id: true },
    });
    return {
      organizationId,
      breakdown: deliveries.map((d) => ({
        attemptCount: d.attemptCount,
        status: d.status,
        total: d._count.id,
      })),
    };
  }

  // 10. Tenant Communication Usage Report
  async getTenantCommunicationUsageReport(organizationId: string) {
    const totalMonthly = await this.prisma.notificationDelivery.count({
      where: {
        organizationId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    const byChannel = await this.prisma.notificationDelivery.groupBy({
      by: ['channel'],
      where: {
        organizationId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
      _count: { id: true },
    });

    return {
      organizationId,
      currentPeriodUsage: totalMonthly,
      channelsUsage: byChannel.map((c) => ({
        channel: c.channel,
        count: c._count.id,
      })),
    };
  }
}
