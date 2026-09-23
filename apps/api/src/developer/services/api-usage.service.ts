import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiUsageRepository } from '../repositories/api-usage.repository';
import { UsageQueryDto } from '../dto/usage-query.dto';
import { MetricsService } from '../../operations/metrics/metrics.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

export interface RecordUsageTelemetryInput {
  organizationId: string;
  apiKeyId?: string | null;
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  userAgent?: string | null;
  clientIp?: string | null;
  apiVersion?: string;
}

@Injectable()
export class ApiUsageService {
  constructor(
    private readonly repository: ApiUsageRepository,
    private readonly metrics: MetricsService,
    private readonly logger: StructuredLoggingService,
  ) {}

  hashIp(ip?: string | null): string | null {
    if (!ip) return null;
    return crypto.createHash('sha256').update(ip).digest('hex');
  }

  computeResponseClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) return '2xx';
    if (statusCode >= 300 && statusCode < 400) return '3xx';
    if (statusCode >= 400 && statusCode < 500) return '4xx';
    if (statusCode >= 500) return '5xx';
    return 'other';
  }

  normalizeRoute(route: string): string {
    // Strip query strings and trailing slashes to prevent cardinality explosion
    return route.split('?')[0].replace(/\/$/, '') || '/';
  }

  async recordUsage(input: RecordUsageTelemetryInput) {
    try {
      const responseClass = this.computeResponseClass(input.statusCode);
      const clientIpHash = this.hashIp(input.clientIp);
      const normalizedRoute = this.normalizeRoute(input.route);

      // Monotonic metric increment in M38 MetricsService
      const metricKey = `tenant.${input.organizationId}.api_requests`;
      this.metrics.incrementCounter(metricKey, {
        method: input.method.toUpperCase(),
        statusCode: String(input.statusCode),
        responseClass,
      });

      return await this.repository.createUsageRecord({
        organizationId: input.organizationId,
        apiKeyId: input.apiKeyId,
        requestId: input.requestId,
        method: input.method.toUpperCase(),
        route: normalizedRoute,
        statusCode: input.statusCode,
        durationMs: input.durationMs,
        responseClass,
        userAgent: input.userAgent,
        clientIpHash,
        apiVersion: input.apiVersion || 'v1',
      });
    } catch (err: unknown) {
      // Telemetry recording must never crash business requests
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.log({
        level: 'WARN',
        message: 'Failed to persist API usage telemetry record',
        module: 'Developer',
        error: errorMsg,
        requestId: input.requestId,
      });
      return null;
    }
  }

  async getUsageRecords(organizationId: string, query: UsageQueryDto) {
    return this.repository.findUsageRecords(organizationId, query);
  }

  async getSummary(organizationId: string, days: number = 30) {
    const [summary, endpoints, breakdown] = await Promise.all([
      this.repository.getAggregatedMetrics(organizationId, days),
      this.repository.getEndpointMetrics(organizationId, days),
      this.repository.getStatusCodeBreakdown(organizationId, days),
    ]);

    return {
      summary,
      topEndpoints: endpoints,
      statusBreakdown: breakdown,
    };
  }

  async getRecentErrors(organizationId: string, limit: number = 20) {
    return this.repository.getRecentErrors(organizationId, limit);
  }
}
