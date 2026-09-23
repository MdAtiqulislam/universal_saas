import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditSanitizerService } from './audit-sanitizer.service';
import { AuditEvent } from './interfaces/audit-event.interface';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sanitizer: AuditSanitizerService,
  ) {}

  /**
   * Append an immutable, tenant-scoped audit log record into PostgreSQL.
   */
  async record(event: AuditEvent): Promise<void> {
    if (!event.organizationId) {
      this.logger.warn(
        `Attempted to record audit event "${event.action}" without organizationId. Skipping persistence.`,
      );
      return;
    }

    try {
      const sanitizedDetails = event.details
        ? (this.sanitizer.sanitize(event.details) as Prisma.InputJsonValue)
        : Prisma.JsonNull;

      await this.prisma.auditLog.create({
        data: {
          organizationId: event.organizationId,
          actorUserId: event.actorUserId ?? null,
          action: event.action,
          resource: event.resource,
          resourceId: event.resourceId ?? null,
          details: sanitizedDetails,
          ipAddress: event.ipAddress ?? null,
          userAgent: event.userAgent ?? null,
          createdAt: event.occurredAt || new Date(),
        },
      });
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to persist audit log for action "${event.action}" in org "${event.organizationId}": ${errMsg}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
