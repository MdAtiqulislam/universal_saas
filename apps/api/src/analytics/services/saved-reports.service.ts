import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SavedReportsRepository } from '../repositories/saved-reports.repository';
import { AnalyticsDefinitionRegistry } from '../registry/analytics-definition.registry';
import {
  CreateSavedReportDto,
  UpdateSavedReportDto,
  QuerySavedReportsDto,
} from '../dto/saved-report.dto';
import {
  ReportShareType,
  SavedReport,
  ReportShare,
  ReportVisibility,
  Prisma,
} from '@prisma/client';
import { AnalyticsQueryEngineService } from './analytics-query-engine.service';
import {
  validateFilterAst,
  AstValidationError,
  MeasureQueryItem,
} from '../dto/analytics-query.dto';

function serializeMeasures(measures?: (string | MeasureQueryItem)[]): string[] {
  if (!measures) return [];
  return measures.map((m) => {
    if (typeof m === 'string') return m;
    return `${m.aggregation}(${m.name})`;
  });
}

@Injectable()
export class SavedReportsService {
  constructor(
    private readonly repo: SavedReportsRepository,
    private readonly queryEngine: AnalyticsQueryEngineService,
    @Optional() private readonly auditService?: AuditService,
  ) {}

  /**
   * Creates a new saved report with validation against definition catalog.
   */
  async createReport(params: {
    organizationId: string;
    userId: string;
    dto: CreateSavedReportDto;
  }): Promise<SavedReport> {
    const { organizationId, userId, dto } = params;

    if (!organizationId) {
      throw new BadRequestException(
        'Tenant configuration must belong to exactly one organization (INV-502)',
      );
    }

    const definition = AnalyticsDefinitionRegistry.get(dto.definitionKey);
    if (!definition) {
      throw new NotFoundException(
        `Analytics definition "${dto.definitionKey}" not found (INV-501)`,
      );
    }

    // Validate dimensions
    if (dto.dimensions) {
      for (const d of dto.dimensions) {
        if (!definition.allowedDimensions.includes(d)) {
          throw new BadRequestException(
            `Dimension "${d}" is not allowed for dataset "${dto.definitionKey}" (INV-505)`,
          );
        }
      }
    }

    // Validate filter AST
    if (dto.filterAst) {
      try {
        validateFilterAst(dto.filterAst, definition.allowedFilterFields);
      } catch (err) {
        if (err instanceof AstValidationError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    const report = await this.repo.create(organizationId, userId, {
      definition: { connect: { definitionKey: dto.definitionKey } },
      name: dto.name,
      description: dto.description,
      dimensions: dto.dimensions ?? [],
      measures: serializeMeasures(dto.measures),
      filterAst: dto.filterAst
        ? (dto.filterAst as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      timeDimension: dto.timeDimension,
      timeGranularity: dto.timeGranularity,
      timeZone: dto.timeZone ?? 'UTC',
      limit: dto.limit ?? 50,
      offset: dto.offset ?? 0,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection ?? 'asc',
      visibility: dto.visibility ?? ReportVisibility.PRIVATE,
    });

    await this.auditService?.record({
      eventName: 'analytics.report.create',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.report.create',
      resource: 'SavedReport',
      resourceId: report.id,
      details: { name: report.name, definitionKey: report.definitionKey },
    });

    return report;
  }

  /**
   * Retrieves a saved report ensuring tenant isolation and access permissions.
   */
  async getReport(params: {
    id: string;
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    userPermissions?: string[];
  }): Promise<SavedReport & { shares: ReportShare[] }> {
    const {
      id,
      organizationId,
      userId,
      userRoles = [],
      userTeams = [],
      userPermissions,
    } = params;
    const report = await this.repo.findById(id, organizationId);

    if (!report) {
      throw new NotFoundException(`Saved report "${id}" not found (INV-506)`);
    }

    // INV-516: Report sharing cannot bypass underlying domain permissions
    if (userPermissions && userId && report.ownerUserId !== userId) {
      const definition = AnalyticsDefinitionRegistry.get(report.definitionKey);
      if (definition && definition.requiredPermissions.length > 0) {
        const hasPermission = definition.requiredPermissions.some(
          (p) =>
            userPermissions.includes(p) ||
            userPermissions.includes('analytics.admin'),
        );
        if (!hasPermission) {
          throw new ForbiddenException(
            `Report sharing cannot bypass underlying domain permissions for "${report.definitionKey}" (INV-516)`,
          );
        }
      }
    }

    // INV-514: Personal reports are accessible only by their owner
    if (
      report.visibility === ReportVisibility.PRIVATE &&
      userId &&
      report.ownerUserId !== userId
    ) {
      const hasUserShare = report.shares.some(
        (s) => s.shareType === ReportShareType.USER && s.targetId === userId,
      );
      const hasRoleShare = report.shares.some(
        (s) =>
          s.shareType === ReportShareType.ROLE &&
          userRoles.includes(s.targetId),
      );
      const hasTeamShare = report.shares.some(
        (s) =>
          s.shareType === ReportShareType.TEAM &&
          userTeams.includes(s.targetId),
      );

      if (!hasUserShare && !hasRoleShare && !hasTeamShare) {
        throw new ForbiddenException(
          'Personal reports are accessible only by their owner (INV-514)',
        );
      }
    }

    return report;
  }

  /**
   * Lists accessible saved reports for tenant and user.
   */
  async listReports(params: {
    organizationId: string;
    userId?: string;
    userRoles?: string[];
    userTeams?: string[];
    queryDto?: QuerySavedReportsDto;
  }): Promise<{ reports: SavedReport[]; total: number }> {
    const { organizationId, userId, userRoles, userTeams, queryDto } = params;

    return this.repo.findMany({
      organizationId,
      userId,
      userRoles,
      userTeams,
      definitionKey: queryDto?.definitionKey,
      visibility: queryDto?.visibility,
      search: queryDto?.search,
      limit: queryDto?.limit,
      offset: queryDto?.offset,
    });
  }

  /**
   * Updates an existing saved report.
   */
  async updateReport(params: {
    id: string;
    organizationId: string;
    userId?: string;
    dto: UpdateSavedReportDto;
  }): Promise<SavedReport> {
    const { id, organizationId, userId, dto } = params;
    const existing = await this.getReport({ id, organizationId, userId });

    if (
      userId &&
      existing.ownerUserId !== userId &&
      existing.visibility === ReportVisibility.PRIVATE
    ) {
      throw new ForbiddenException(
        'Only report owner can modify private report (INV-506)',
      );
    }

    // If filter AST changed, validate
    if (dto.filterAst) {
      const definition = AnalyticsDefinitionRegistry.get(
        existing.definitionKey,
      );
      if (definition) {
        validateFilterAst(dto.filterAst, definition.allowedFilterFields);
      }
    }

    const updated = await this.repo.update(id, organizationId, {
      name: dto.name,
      description: dto.description,
      dimensions: dto.dimensions,
      measures: dto.measures ? serializeMeasures(dto.measures) : undefined,
      filterAst: dto.filterAst
        ? (dto.filterAst as unknown as Prisma.InputJsonValue)
        : undefined,
      timeDimension: dto.timeDimension,
      timeGranularity: dto.timeGranularity,
      timeZone: dto.timeZone,
      limit: dto.limit,
      offset: dto.offset,
      sortBy: dto.sortBy,
      sortDirection: dto.sortDirection,
      visibility: dto.visibility,
    });

    await this.auditService?.record({
      eventName: 'analytics.report.update',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.report.update',
      resource: 'SavedReport',
      resourceId: id,
    });

    return updated;
  }

  /**
   * Deletes a saved report.
   */
  async deleteReport(params: {
    id: string;
    organizationId: string;
    userId?: string;
  }): Promise<SavedReport> {
    const { id, organizationId, userId } = params;
    const existing = await this.getReport({ id, organizationId, userId });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only report owner can delete saved report (INV-506)',
      );
    }

    const deleted = await this.repo.delete(id, organizationId);

    await this.auditService?.record({
      eventName: 'analytics.report.delete',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.report.delete',
      resource: 'SavedReport',
      resourceId: id,
    });

    return deleted;
  }

  /**
   * Shares a saved report with a user, role, or team in the same organization (INV-508).
   */
  async shareReport(params: {
    savedReportId: string;
    organizationId: string;
    userId?: string;
    shareType: ReportShareType;
    targetId: string;
  }): Promise<ReportShare> {
    const { savedReportId, organizationId, userId, shareType, targetId } =
      params;
    const existing = await this.getReport({
      id: savedReportId,
      organizationId,
      userId,
    });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only report owner can share report (INV-508)',
      );
    }

    if (!targetId || targetId.trim() === '') {
      throw new BadRequestException(
        'Target ID is required for sharing (INV-515)',
      );
    }

    const share = await this.repo.addShare(
      savedReportId,
      organizationId,
      shareType,
      targetId,
    );

    await this.auditService?.record({
      eventName: 'analytics.report.share',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'analytics.report.share',
      resource: 'ReportShare',
      resourceId: share.id,
      details: { savedReportId, shareType, targetId },
    });

    return share;
  }

  /**
   * Revokes a report share.
   */
  async revokeShare(params: {
    savedReportId: string;
    organizationId: string;
    userId?: string;
    shareType: ReportShareType;
    targetId: string;
  }): Promise<void> {
    const { savedReportId, organizationId, userId, shareType, targetId } =
      params;
    const existing = await this.getReport({
      id: savedReportId,
      organizationId,
      userId,
    });

    if (userId && existing.ownerUserId !== userId) {
      throw new ForbiddenException(
        'Only report owner can revoke report share (INV-508)',
      );
    }

    await this.repo.removeShare(
      savedReportId,
      organizationId,
      shareType,
      targetId,
    );
  }

  /**
   * Lists shares for a report.
   */
  async listShares(params: {
    savedReportId: string;
    organizationId: string;
    userId?: string;
  }): Promise<ReportShare[]> {
    const { savedReportId, organizationId, userId } = params;
    await this.getReport({ id: savedReportId, organizationId, userId });
    return this.repo.listShares(savedReportId, organizationId);
  }
}
