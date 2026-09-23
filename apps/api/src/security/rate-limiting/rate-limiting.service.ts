import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitingService {
  private readonly logger = new Logger(RateLimitingService.name);
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check and consume rate limit quota for a given key.
   * Returns remaining requests and whether request is allowed.
   */
  async checkRateLimit(
    key: string,
    limit: number = 120,
    windowSeconds: number = 60,
    organizationId?: string,
  ): Promise<{
    allowed: boolean;
    current: number;
    limit: number;
    remaining: number;
    resetAt: Date;
  }> {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now > existing.resetAt) {
      const resetAt = now + windowSeconds * 1000;
      this.buckets.set(key, { count: 1, resetAt });
      return {
        allowed: true,
        current: 1,
        limit,
        remaining: limit - 1,
        resetAt: new Date(resetAt),
      };
    }

    existing.count++;

    const allowed = existing.count <= limit;
    const remaining = Math.max(0, limit - existing.count);

    if (!allowed && existing.count === limit + 1) {
      this.logger.warn(
        `Rate limit exceeded for key: ${key} (${existing.count}/${limit})`,
      );
      if (organizationId) {
        // Record security event for rate limit violation
        await this.prisma.securityEvent
          .create({
            data: {
              organizationId,
              category: 'API_ABUSE',
              eventType: 'RATE_LIMIT_EXCEEDED',
              severity: 'MEDIUM',
              details: { key, count: existing.count, limit },
            },
          })
          .catch(() => null);
      }
    }

    return {
      allowed,
      current: existing.count,
      limit,
      remaining,
      resetAt: new Date(existing.resetAt),
    };
  }

  clear(): void {
    this.buckets.clear();
  }
}
