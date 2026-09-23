import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditSanitizerService } from '../../audit/audit-sanitizer.service';
import {
  CreateSecurityEventDto,
  SecurityEventQueryDto,
} from '../dto/security-events.dto';

@Injectable()
export class SecurityEventsService {
  private readonly logger = new Logger(SecurityEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: AuditSanitizerService,
  ) {}

  async logEvent(organizationId?: string, dto?: CreateSecurityEventDto) {
    if (!dto) return null;

    const sanitizedDetails = dto.details
      ? (this.sanitizer.sanitize(dto.details) as any)
      : undefined;

    return this.prisma.securityEvent.create({
      data: {
        organizationId: organizationId ?? null,
        category: dto.category,
        eventType: dto.eventType,
        severity: dto.severity ?? 'INFO',
        actorUserId: dto.actorUserId ?? null,
        ipAddress: dto.ipAddress ?? null,
        userAgent: dto.userAgent ?? null,
        resource: dto.resource ?? null,
        resourceId: dto.resourceId ?? null,
        details: sanitizedDetails ?? undefined,
      },
    });
  }

  async listEvents(organizationId: string, query?: SecurityEventQueryDto) {
    const where: any = { organizationId };

    if (query?.category) where.category = query.category;
    if (query?.severity) where.severity = query.severity;
    if (query?.eventType)
      where.eventType = { contains: query.eventType, mode: 'insensitive' };
    if (query?.actorUserId) where.actorUserId = query.actorUserId;

    if (query?.startDate || query?.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    return this.prisma.securityEvent.findMany({
      where,
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getEvent(organizationId: string, id: string) {
    const event = await this.prisma.securityEvent.findFirst({
      where: { id, organizationId },
      include: {
        actorUser: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Security event ${id} not found.`);
    }

    return event;
  }
}
