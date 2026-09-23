import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SecurityReportQueryDto } from '../dto/security-reports.dto';

@Injectable()
export class SecurityReportsService {
  private readonly logger = new Logger(SecurityReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private parseDateFilter(query?: SecurityReportQueryDto) {
    const filter: any = {};
    if (query?.startDate || query?.endDate) {
      filter.createdAt = {};
      if (query.startDate) filter.createdAt.gte = new Date(query.startDate);
      if (query.endDate) filter.createdAt.lte = new Date(query.endDate);
    }
    return filter;
  }

  // 1. Authentication Activity Report
  async getAuthActivityReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const attempts = await this.prisma.loginAttempt.findMany({
      where: { organizationId, ...dateFilter },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const total = attempts.length;
    const successful = attempts.filter((a) => a.status === 'SUCCESS').length;
    const failed = attempts.filter((a) => a.status === 'FAILED').length;
    const locked = attempts.filter((a) => a.status === 'LOCKED').length;

    return {
      reportName: 'Authentication Activity Report',
      summary: {
        total,
        successful,
        failed,
        locked,
        successRatePercentage:
          total > 0 ? Number(((successful / total) * 100).toFixed(1)) : 100,
      },
      attempts,
    };
  }

  // 2. Failed Login & Brute Force Report
  async getFailedLoginReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const failedAttempts = await this.prisma.loginAttempt.findMany({
      where: {
        organizationId,
        status: { in: ['FAILED', 'LOCKED', 'BLOCKED'] },
        ...dateFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // Group by email & IP to detect brute force hotspots
    const ipCounts: Record<string, number> = {};
    const emailCounts: Record<string, number> = {};

    for (const a of failedAttempts) {
      if (a.ipAddress) ipCounts[a.ipAddress] = (ipCounts[a.ipAddress] || 0) + 1;
      emailCounts[a.email] = (emailCounts[a.email] || 0) + 1;
    }

    return {
      reportName: 'Failed Login & Brute Force Report',
      totalFailures: failedAttempts.length,
      topTargetedEmails: Object.entries(emailCounts).map(([email, count]) => ({
        email,
        count,
      })),
      topAttackingIps: Object.entries(ipCounts).map(([ipAddress, count]) => ({
        ipAddress,
        count,
      })),
      recentFailures: failedAttempts,
    };
  }

  // 3. Active Session Report
  async getActiveSessionReport(organizationId: string) {
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = orgMembers.map((m) => m.userId);

    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId: { in: userIds },
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { lastActivityAt: 'desc' },
    });

    return {
      reportName: 'Active Session Report',
      activeSessionsCount: activeSessions.length,
      sessions: activeSessions.map((s) => ({
        id: s.id,
        userId: s.userId,
        userEmail: s.user.email,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        lastActivityAt: s.lastActivityAt,
        expiresAt: s.expiresAt,
        createdAt: s.createdAt,
      })),
    };
  }

  // 4. Privileged Action Report
  async getPrivilegedActionReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        organizationId,
        category: { in: ['ADMINISTRATION', 'CONFIGURATION'] },
        ...dateFilter,
      },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      reportName: 'Privileged Action Report',
      totalPrivilegedActions: events.length,
      actions: events,
    };
  }

  // 5. Authorization Failure Report
  async getAuthFailureReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        organizationId,
        category: 'AUTHORIZATION',
        ...dateFilter,
      },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      reportName: 'Authorization Failure Report',
      totalDenials: events.length,
      denials: events,
    };
  }

  // 6. Tenant Security Events Report
  async getTenantSecurityEventsReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: { organizationId, ...dateFilter },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const categoryBreakdown: Record<string, number> = {};
    const severityBreakdown: Record<string, number> = {};

    for (const e of events) {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + 1;
      severityBreakdown[e.severity] = (severityBreakdown[e.severity] || 0) + 1;
    }

    return {
      reportName: 'Tenant Security Events Report',
      totalEvents: events.length,
      categoryBreakdown,
      severityBreakdown,
      events,
    };
  }

  // 7. API Rate Limit Violation Report
  async getRateLimitViolationReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        organizationId,
        category: 'API_ABUSE',
        eventType: 'RATE_LIMIT_EXCEEDED',
        ...dateFilter,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      reportName: 'API Rate Limit Violation Report',
      totalViolations: events.length,
      violations: events,
    };
  }

  // 8. Suspicious Activity Report
  async getSuspiciousActivityReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        organizationId,
        severity: { in: ['HIGH', 'CRITICAL'] },
        ...dateFilter,
      },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      reportName: 'Suspicious Activity Report',
      totalSuspiciousEvents: events.length,
      events,
    };
  }

  // 9. Security Incident Timeline
  async getSecurityIncidentTimeline(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: { organizationId, ...dateFilter },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return {
      reportName: 'Security Incident Timeline',
      timelineCount: events.length,
      timeline: events.map((e) => ({
        id: e.id,
        timestamp: e.createdAt,
        category: e.category,
        eventType: e.eventType,
        severity: e.severity,
        actorEmail: e.actorUser?.email || 'System / Anonymous',
        ipAddress: e.ipAddress,
        resource: e.resource,
        resourceId: e.resourceId,
        details: e.details,
      })),
    };
  }

  // 10. Administrative Change Report
  async getAdminChangeReport(
    organizationId: string,
    query?: SecurityReportQueryDto,
  ) {
    const dateFilter = this.parseDateFilter(query);
    const events = await this.prisma.securityEvent.findMany({
      where: {
        organizationId,
        category: 'ADMINISTRATION',
        ...dateFilter,
      },
      include: { actorUser: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return {
      reportName: 'Administrative Change Report',
      totalAdminChanges: events.length,
      changes: events,
    };
  }
}
