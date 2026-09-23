import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { SessionQueryDto } from '../dto/security-sessions.dto';

@Injectable()
export class SecuritySessionsService {
  private readonly logger = new Logger(SecuritySessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async listSessions(organizationId: string, query?: SessionQueryDto) {
    const orgMembers = await this.prisma.organizationMember.findMany({
      where: { organizationId },
      select: { userId: true },
    });
    const userIds = orgMembers.map((m) => m.userId);

    if (userIds.length === 0) return [];

    const where: any = {
      userId: query?.userId ? query.userId : { in: userIds },
    };

    if (query?.status === 'ACTIVE') {
      where.revokedAt = null;
      where.expiresAt = { gt: new Date() };
    } else if (query?.status === 'REVOKED') {
      where.revokedAt = { not: null };
    } else if (query?.status === 'EXPIRED') {
      where.revokedAt = null;
      where.expiresAt = { lte: new Date() };
    }

    const sessions = await this.prisma.session.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return sessions.map((s) => ({
      id: s.id,
      userId: s.userId,
      userEmail: s.user.email,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      deviceInfo: s.deviceInfo,
      status: s.revokedAt
        ? 'REVOKED'
        : s.expiresAt < new Date()
          ? 'EXPIRED'
          : 'ACTIVE',
      revokedAt: s.revokedAt,
      revokedReason: s.revokedReason,
      lastActivityAt: s.lastActivityAt,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(
    organizationId: string,
    sessionId: string,
    reason: string = 'Administrative revocation',
    actorUserId?: string,
  ) {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found.`);
    }

    if (session.revokedAt) {
      throw new BadRequestException(`Session ${sessionId} is already revoked.`);
    }

    const updated = await this.prisma.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });

    await this.eventBus.publish({
      eventName: 'SESSION_REVOKED',
      occurredAt: new Date(),
      organizationId,
      sessionId,
      userId: session.userId,
      actorUserId,
      reason,
    });

    await this.prisma.securityEvent.create({
      data: {
        organizationId,
        category: 'SESSION',
        eventType: 'SESSION_REVOKED',
        severity: 'MEDIUM',
        actorUserId: actorUserId ?? session.userId,
        resource: 'session',
        resourceId: sessionId,
        details: { reason, targetUserId: session.userId },
      },
    });

    return {
      id: updated.id,
      status: 'REVOKED',
      revokedAt: updated.revokedAt,
      revokedReason: updated.revokedReason,
    };
  }

  async revokeAllUserSessions(
    organizationId: string,
    userId: string,
    reason: string = 'Global logout across all devices',
    actorUserId?: string,
  ) {
    const activeSessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
      },
    });

    if (activeSessions.length === 0) {
      return { revokedCount: 0, message: 'No active sessions found for user.' };
    }

    const now = new Date();
    const result = await this.prisma.session.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: now,
        revokedReason: reason,
      },
    });

    await this.eventBus.publish({
      eventName: 'LOGOUT_ALL_DEVICES',
      occurredAt: now,
      organizationId,
      userId,
      actorUserId,
      revokedCount: result.count,
    });

    await this.prisma.securityEvent.create({
      data: {
        organizationId,
        category: 'SESSION',
        eventType: 'LOGOUT_ALL_DEVICES',
        severity: 'HIGH',
        actorUserId: actorUserId ?? userId,
        resource: 'user',
        resourceId: userId,
        details: { reason, revokedCount: result.count },
      },
    });

    return {
      revokedCount: result.count,
      message: `Revoked ${result.count} active session(s) for user.`,
    };
  }
}
