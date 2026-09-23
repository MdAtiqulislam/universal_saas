import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface IdempotencyStartResult {
  isReplay: boolean;
  statusCode?: number;
  responseBody?: any;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hashPayload(payload: any): string {
    if (!payload) return '';
    try {
      const str =
        typeof payload === 'string' ? payload : JSON.stringify(payload);
      return crypto.createHash('sha256').update(str).digest('hex');
    } catch {
      return '';
    }
  }

  async start(
    organizationId: string,
    idempotencyKey: string,
    action: string,
    requestPayload?: any,
    ttlHours: number = 24,
  ): Promise<IdempotencyStartResult> {
    const now = new Date();
    const requestHash = this.hashPayload(requestPayload);

    let existing = await this.prisma.idempotencyRecord.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId,
          idempotencyKey,
        },
      },
    });

    if (existing) {
      // Check if expired
      if (existing.expiresAt < now) {
        // Expired record can be replaced
        await this.prisma.idempotencyRecord.delete({
          where: { id: existing.id },
        });
        existing = null;
      } else if (
        existing.action !== action ||
        existing.requestHash !== requestHash
      ) {
        throw new ConflictException(
          `Idempotency key "${idempotencyKey}" is bound to a different request.`,
        );
      } else if (existing.status === 'COMPLETED') {
        return {
          isReplay: true,
          statusCode: existing.statusCode || 200,
          responseBody: existing.responseBody,
        };
      } else if (existing.status === 'PENDING') {
        throw new ConflictException(
          `A concurrent operation with idempotency key "${idempotencyKey}" is currently processing.`,
        );
      }
      // If status === 'FAILED', allow retry
    }

    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    if (existing) {
      await this.prisma.idempotencyRecord.update({
        where: { id: existing.id },
        data: {
          action,
          status: 'PENDING',
          requestHash,
          expiresAt,
          statusCode: null,
          responseBody: undefined,
        },
      });
    } else {
      await this.prisma.idempotencyRecord.create({
        data: {
          organizationId,
          idempotencyKey,
          action,
          status: 'PENDING',
          requestHash,
          expiresAt,
        },
      });
    }

    return { isReplay: false };
  }

  async complete(
    organizationId: string,
    idempotencyKey: string,
    statusCode: number,
    responseBody: any,
    resource?: string,
    resourceId?: string,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: { organizationId, idempotencyKey },
      data: {
        status: 'COMPLETED',
        statusCode,
        responseBody: responseBody ?? {},
        resource,
        resourceId,
      },
    });
  }

  async fail(
    organizationId: string,
    idempotencyKey: string,
    error: string,
  ): Promise<void> {
    await this.prisma.idempotencyRecord.updateMany({
      where: { organizationId, idempotencyKey },
      data: {
        status: 'FAILED',
        responseBody: { error },
      },
    });
  }
}
