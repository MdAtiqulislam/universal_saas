import { Injectable } from '@nestjs/common';
import {
  OperationalErrorCategory,
  OperationalErrorSeverity,
  OperationalError,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StructuredLoggingService } from '../logging/structured-logging.service';
import { OperationalErrorQueryDto } from '../dto/operational-error-query.dto';
import * as crypto from 'crypto';

export interface ErrorClassification {
  category: OperationalErrorCategory;
  severity: OperationalErrorSeverity;
}

export interface CreateOperationalErrorDto {
  module: string;
  message: string;
  category: OperationalErrorCategory;
  severity: OperationalErrorSeverity;
  errorCode: string;
  stackTrace?: string;
  metadata?: Prisma.InputJsonValue;
  organizationId?: string;
}

export interface ErrorTrendResult {
  category: string;
  count: number;
}

@Injectable()
export class OperationalErrorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: StructuredLoggingService,
  ) {}

  classify(error: Error, module: string): ErrorClassification {
    const name = error.name || 'Error';
    const message = error.message || '';
    if (module === 'Security' || name.includes('Security')) {
      return {
        category: OperationalErrorCategory.SECURITY,
        severity: OperationalErrorSeverity.CRITICAL,
      };
    }
    if (
      name.includes('Prisma') ||
      name.includes('DB') ||
      name.includes('Query') ||
      message.includes('database')
    ) {
      return {
        category: OperationalErrorCategory.DATABASE,
        severity: OperationalErrorSeverity.HIGH,
      };
    }
    if (
      name.includes('Network') ||
      name.includes('Fetch') ||
      name.includes('Timeout')
    ) {
      return {
        category: OperationalErrorCategory.EXTERNAL_SERVICE,
        severity: OperationalErrorSeverity.MEDIUM,
      };
    }
    if (name === 'BadRequestException') {
      return {
        category: OperationalErrorCategory.VALIDATION,
        severity: OperationalErrorSeverity.LOW,
      };
    }
    if (name === 'UnauthorizedException') {
      return {
        category: OperationalErrorCategory.AUTHENTICATION,
        severity: OperationalErrorSeverity.MEDIUM,
      };
    }
    if (name === 'ForbiddenException') {
      return {
        category: OperationalErrorCategory.AUTHORIZATION,
        severity: OperationalErrorSeverity.MEDIUM,
      };
    }
    if (name === 'NotFoundException') {
      return {
        category: OperationalErrorCategory.NOT_FOUND,
        severity: OperationalErrorSeverity.LOW,
      };
    }
    if (name === 'ConflictException') {
      return {
        category: OperationalErrorCategory.CONFLICT,
        severity: OperationalErrorSeverity.LOW,
      };
    }
    return {
      category: OperationalErrorCategory.INTERNAL,
      severity: OperationalErrorSeverity.MEDIUM,
    };
  }

  fingerprint(module: string, errorCode: string, stack?: string): string {
    let sig = '';
    if (stack) {
      // Use first 3 sanitized lines (strip file paths to prevent secret leakage)
      const lines = stack
        .split('\n')
        .slice(0, 3)
        .map((l) => l.trim().replace(/\/[^\s]+/g, 'path'));
      sig = lines.join('|');
    }
    const hash = crypto.createHash('sha256');
    hash.update(`${module}:${errorCode}:${sig}`);
    return hash.digest('hex'); // INV-330
  }

  async record(
    dto: CreateOperationalErrorDto,
  ): Promise<OperationalError | null> {
    try {
      // Sanitize message — strip potential secrets (INV-329)
      const sanitizedMessage = dto.message
        .replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          '[UUID]',
        )
        .substring(0, 500);
      const stackHash = this.fingerprint(
        dto.module,
        dto.errorCode,
        dto.stackTrace,
      );

      return await this.prisma.operationalError.create({
        data: {
          module: dto.module,
          errorCode: dto.errorCode,
          message: sanitizedMessage,
          category: dto.category,
          severity: dto.severity,
          stackHash,
          metadata: dto.metadata ?? Prisma.JsonNull,
          organizationId: dto.organizationId ?? null,
          occurredAt: new Date(),
        },
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : 'Unknown error';
      this.logger.error(
        `Failed to record operational error: ${errMsg}`,
        undefined,
        'OperationalErrorsService',
      );
      return null;
    }
  }

  async listErrors(
    organizationId: string,
    query: OperationalErrorQueryDto,
  ): Promise<OperationalError[]> {
    const where: Prisma.OperationalErrorWhereInput = { organizationId };
    if (query.category) where.category = query.category;
    if (query.severity) where.severity = query.severity;
    if (query.days) {
      const date = new Date();
      date.setDate(date.getDate() - query.days);
      where.createdAt = { gte: date };
    }
    return this.prisma.operationalError.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async getErrorTrends(organizationId?: string): Promise<ErrorTrendResult[]> {
    const where: Prisma.OperationalErrorWhereInput = organizationId
      ? { organizationId }
      : {};
    const res = await this.prisma.operationalError.groupBy({
      by: ['category'],
      _count: { id: true },
      where,
    });
    return res.map((r) => ({ category: r.category, count: r._count.id }));
  }
}
