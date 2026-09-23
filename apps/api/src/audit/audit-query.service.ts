import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { PaginatedAuditLogs } from './dto/audit-response.dto';

@Injectable()
export class AuditQueryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query tenant-scoped audit logs with filters, pagination, and chronological ordering.
   */
  async list(
    organizationId: string,
    query: AuditQueryDto,
  ): Promise<PaginatedAuditLogs> {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      organizationId,
    };

    if (query.action) {
      where.action = {
        equals: query.action,
        mode: 'insensitive',
      };
    }

    if (query.resource) {
      where.resource = {
        equals: query.resource,
        mode: 'insensitive',
      };
    }

    if (query.actorUserId) {
      where.actorUserId = query.actorUserId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        where.createdAt.gte = new Date(query.from);
      }
      if (query.to) {
        where.createdAt.lte = new Date(query.to);
      }
    }

    const [total, records] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        include: {
          actorUser: {
            select: {
              id: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
    ]);

    const items = records.map((r) => ({
      id: r.id,
      organizationId: r.organizationId,
      actorUserId: r.actorUserId,
      actorUser: r.actorUser
        ? { id: r.actorUser.id, email: r.actorUser.email }
        : null,
      action: r.action,
      resource: r.resource,
      resourceId: r.resourceId,
      details: r.details,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      createdAt: r.createdAt,
    }));

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }
}
