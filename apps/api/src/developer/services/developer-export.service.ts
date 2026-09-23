import { Injectable } from '@nestjs/common';
import { ApiUsageRepository } from '../repositories/api-usage.repository';
import { AuditService } from '../../audit/audit.service';
import { UsageExportDto } from '../dto/usage-export.dto';

@Injectable()
export class DeveloperExportService {
  constructor(
    private readonly usageRepository: ApiUsageRepository,
    private readonly audit: AuditService,
  ) {}

  async exportUsageCsv(
    organizationId: string,
    actorUserId: string,
    dto: UsageExportDto,
  ): Promise<{ filename: string; csvContent: string; recordCount: number }> {
    const usageData = await this.usageRepository.findUsageRecords(
      organizationId,
      {
        days: dto.days || 30,
        apiKeyId: dto.apiKeyId,
        route: dto.route,
        page: 1,
        limit: 5000,
      },
    );

    const headers = [
      'Timestamp',
      'Request ID',
      'Method',
      'Route',
      'Status Code',
      'Response Class',
      'Duration (ms)',
      'API Key Prefix',
      'API Version',
    ];

    const rows = usageData.records.map((r) => [
      r.createdAt.toISOString(),
      r.requestId,
      r.method,
      `"${r.route.replace(/"/g, '""')}"`,
      r.statusCode,
      r.responseClass,
      r.durationMs,
      r.apiKey?.keyPrefix ? `"${r.apiKey.keyPrefix}"` : 'N/A',
      r.apiVersion,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `api-usage-${organizationId}-${timestampStr}.csv`;

    await this.audit.record({
      eventName: 'API_USAGE_EXPORTED',
      action: 'API_USAGE_EXPORTED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      resource: 'api_usage',
      resourceId: organizationId,
      details: {
        recordCount: usageData.records.length,
        days: dto.days,
        format: 'csv',
      },
    });

    return {
      filename,
      csvContent,
      recordCount: usageData.records.length,
    };
  }
}
