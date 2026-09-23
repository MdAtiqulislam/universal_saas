import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SecurityDashboardService {
  private readonly logger = new Logger(SecurityDashboardService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboardSummary(organizationId: string) {
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = orgMembers.map((m) => m.userId);

    const now = new Date();
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalAttempts24h,
      failedAttempts24h,
      activeSessions,
      lockedUsers,
      highCriticalEvents24h,
      rateLimitViolations24h,
      recentEvents,
    ] = await Promise.all([
      this.prisma.loginAttempt.count({
        where: { organizationId, createdAt: { gte: past24h } },
      }),
      this.prisma.loginAttempt.count({
        where: {
          organizationId,
          status: { in: ['FAILED', 'LOCKED', 'BLOCKED'] },
          createdAt: { gte: past24h },
        },
      }),
      this.prisma.session.count({
        where: {
          userId: { in: userIds },
          revokedAt: null,
          expiresAt: { gt: now },
        },
      }),
      this.prisma.user.count({
        where: {
          id: { in: userIds },
          lockedUntil: { gt: now },
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          organizationId,
          severity: { in: ['HIGH', 'CRITICAL'] },
          createdAt: { gte: past24h },
        },
      }),
      this.prisma.securityEvent.count({
        where: {
          organizationId,
          category: 'API_ABUSE',
          eventType: 'RATE_LIMIT_EXCEEDED',
          createdAt: { gte: past24h },
        },
      }),
      this.prisma.securityEvent.findMany({
        where: { organizationId },
        include: { actorUser: { select: { email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const successAttempts24h = Math.max(
      0,
      totalAttempts24h - failedAttempts24h,
    );
    const authSuccessRate =
      totalAttempts24h > 0
        ? Number(((successAttempts24h / totalAttempts24h) * 100).toFixed(1))
        : 100;

    return {
      kpis: {
        totalLoginAttempts24h: totalAttempts24h,
        successfulLogins24h: successAttempts24h,
        failedLogins24h: failedAttempts24h,
        authSuccessRatePercentage: authSuccessRate,
        activeSessionsCount: activeSessions,
        lockedAccountsCount: lockedUsers,
        highCriticalIncidents24h: highCriticalEvents24h,
        rateLimitViolations24h,
      },
      recentEvents,
    };
  }
}
