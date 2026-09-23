import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EntitlementsService } from '../../billing/services/entitlements.service';
import { DataOperationType, DataOperationStatus } from '@prisma/client';

export const MAX_CONCURRENT_DATA_JOBS = 3;

/**
 * INV-546: Data operation quotas are enforced through M42 entitlement/usage controls.
 */
@Injectable()
export class DataOperationQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /**
   * Asserts that organization is within its quota limits for the operation.
   */
  async assertQuota(
    organizationId: string,
    operationType: DataOperationType,
    estimatedRows: number = 1,
  ): Promise<void> {
    const metricKey =
      operationType === DataOperationType.EXPORT
        ? 'data_operations.exports.monthly'
        : 'data_operations.imports.monthly';

    // 1. Quota check via M42 EntitlementsService
    await this.entitlements.assertWithinQuota(organizationId, metricKey, 1);

    // 2. Row volume quota check
    if (estimatedRows > 0) {
      await this.entitlements.assertWithinQuota(
        organizationId,
        'data_operations.rows.limit',
        estimatedRows,
      );
    }

    await this.withConcurrentSlot(organizationId, async () => undefined);
  }

  /**
   * Serializes admission for one organization. The callback must create the
   * queued/processing job while the lock is held; callers cannot observe a
   * successful check without also reserving the slot.
   */
  async withConcurrentSlot<T>(organizationId: string, callback: () => Promise<T>): Promise<T> {
    const transaction = this.prisma.$transaction;
    if (typeof transaction !== 'function') {
      throw new ForbiddenException('Atomic data-operation quota reservation is unavailable.');
    }

    return transaction.call(this.prisma, async (tx: any) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`data-operations:${organizationId}`}))`;
      }
      const activeJobs = await tx.dataOperationJob.count({
        where: {
          organizationId,
          status: { in: [DataOperationStatus.PROCESSING, DataOperationStatus.QUEUED, DataOperationStatus.PREVIEWING] },
        },
      });
      if (activeJobs >= MAX_CONCURRENT_DATA_JOBS) {
        throw new ForbiddenException(
          `Concurrent data operations limit reached (${MAX_CONCURRENT_DATA_JOBS} active jobs). Please wait for ongoing jobs to complete.`,
        );
      }
      return callback();
    }) as Promise<T>;
  }
}
