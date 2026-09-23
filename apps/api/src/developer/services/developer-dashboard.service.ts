import { Injectable } from '@nestjs/common';
import { ApiUsageService } from './api-usage.service';
import { ApiContractService } from './api-contract.service';
import { RateLimitingService } from '../../security/rate-limiting/rate-limiting.service';

@Injectable()
export class DeveloperDashboardService {
  constructor(
    private readonly usageService: ApiUsageService,
    private readonly contractService: ApiContractService,
    private readonly rateLimiting: RateLimitingService,
  ) {}

  async getOverview(organizationId: string) {
    const [summaryData, recentErrors] = await Promise.all([
      this.usageService.getSummary(organizationId, 30),
      this.usageService.getRecentErrors(organizationId, 5),
    ]);

    // Check rate limit visibility for tenant (e.g. limit 1000 per hour window)
    const rateLimitCheck = await this.rateLimiting.checkRateLimit(
      `tenant:${organizationId}:api_call`,
      1000,
      3600,
      organizationId,
    );

    const versions = this.contractService.getApiVersions();
    const endpointCount = this.contractService.listEndpoints().length;

    return {
      kpis: {
        totalRequests: summaryData.summary.totalRequests,
        requests24h: summaryData.summary.requests24h,
        successRate: summaryData.summary.successRate,
        errorRate: summaryData.summary.errorRate,
        p95Latency: summaryData.summary.p95Latency,
        rateLimitedCount: summaryData.summary.rateLimitedCount,
        activeKeysCount: summaryData.summary.activeKeysCount,
        endpointCount,
      },
      rateLimit: {
        limit: rateLimitCheck.limit,
        remaining: rateLimitCheck.remaining,
        resetSeconds: Math.max(
          0,
          Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 1000),
        ),
        allowed: rateLimitCheck.allowed,
        windowSeconds: 3600,
      },
      topEndpoints: summaryData.topEndpoints,
      recentErrors: recentErrors.map((e) => ({
        id: e.id,
        route: e.route,
        method: e.method,
        statusCode: e.statusCode,
        requestId: e.requestId,
        keyPrefix: e.apiKey?.keyPrefix ?? null,
        createdAt: e.createdAt,
      })),
      versions,
    };
  }
}
