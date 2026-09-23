import { Injectable, BadRequestException } from '@nestjs/common';
import { AnalyticsQueryEngineService } from './analytics-query-engine.service';
import { ExportQueryDto } from '../dto/export-query.dto';
import { ExportFormat } from '@prisma/client';

export interface ExportResult {
  format: ExportFormat;
  contentType: string;
  filename: string;
  data: string;
  rowCount: number;
}

@Injectable()
export class ReportExportService {
  public static readonly MAX_EXPORT_ROWS = 10000;

  constructor(private readonly queryEngine: AnalyticsQueryEngineService) {}

  /**
   * Generates a bounded CSV or JSON export from an analytics query (INV-511).
   */
  async exportData(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    exportDto: ExportQueryDto;
  }): Promise<ExportResult> {
    const { organizationId, userId, userPermissions, exportDto } = params;

    const requestedMaxRows = exportDto.maxRows ?? 1000;
    if (requestedMaxRows > ReportExportService.MAX_EXPORT_ROWS) {
      throw new BadRequestException(
        `Export row limit cannot exceed ${ReportExportService.MAX_EXPORT_ROWS} (INV-511)`,
      );
    }

    const queryCopy = {
      ...exportDto.query,
      limit: requestedMaxRows,
      offset: 0,
    };

    const queryResult = await this.queryEngine.execute({
      organizationId,
      userId,
      userPermissions,
      query: queryCopy,
    });

    const rows = queryResult.data;
    const format = exportDto.format;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `export_${queryResult.meta.definitionKey}_${timestamp}.${format.toLowerCase()}`;

    if (format === ExportFormat.JSON) {
      return {
        format,
        contentType: 'application/json',
        filename,
        data: JSON.stringify(rows, null, 2),
        rowCount: rows.length,
      };
    }

    // CSV format
    const csvContent = this.convertToCsv(rows);
    return {
      format,
      contentType: 'text/csv',
      filename,
      data: csvContent,
      rowCount: rows.length,
    };
  }

  /**
   * Converts row objects into RFC 4180 compliant CSV string with escaping.
   */
  public convertToCsv(rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return '';
    }

    const headers = Object.keys(rows[0]);
    const headerLine = headers.map((h) => this.escapeCsvValue(h)).join(',');

    const dataLines = rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h];
          return this.escapeCsvValue(val);
        })
        .join(','),
    );

    return [headerLine, ...dataLines].join('\n');
  }

  private escapeCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    let str = '';
    if (typeof value === 'object') {
      str = JSON.stringify(value);
    } else if (typeof value === 'string') {
      str = value;
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      str = value.toString();
    }
    if (
      str.includes(',') ||
      str.includes('"') ||
      str.includes('\n') ||
      str.includes('\r')
    ) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}
