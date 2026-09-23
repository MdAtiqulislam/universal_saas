import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
  Optional,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AnalyticsDefinitionRegistry,
  AnalyticsDefinitionRecord,
} from '../registry/analytics-definition.registry';
import {
  AnalyticsQueryDto,
  validateFilterAst,
  FilterNode,
  AST_BOUNDS,
  AstValidationError,
} from '../dto/analytics-query.dto';
import {
  TimeAnalyticsService,
  TimeGranularity,
} from './time-analytics.service';
import { AnalyticsUsageRepository } from '../repositories/analytics-usage.repository';

export interface AnalyticsQueryResult {
  data: Record<string, unknown>[];
  meta: {
    definitionKey: string;
    dimensions: string[];
    measures: string[];
    totalRows: number;
    executionTimeMs: number;
    timeDimension?: string;
    timeGranularity?: string;
    timeZone: string;
    limit: number;
    offset: number;
  };
  cacheHit?: boolean;
}

function safeStringify(val: unknown): string {
  if (val === null || val === undefined) {
    return 'null';
  }
  if (typeof val === 'string') {
    return val;
  }
  if (
    typeof val === 'number' ||
    typeof val === 'boolean' ||
    typeof val === 'bigint'
  ) {
    return val.toString();
  }
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return '[object]';
    }
  }
  return '';
}

@Injectable()
export class AnalyticsQueryEngineService {
  private readonly logger = new Logger(AnalyticsQueryEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeService: TimeAnalyticsService,
    private readonly usageRepo: AnalyticsUsageRepository,
    @Optional() private readonly cacheService?: CacheService,
  ) {}

  /**
   * INV-523: Builds an authoritative cache key containing all required tenant, security,
   * definition, and query dimensions to guarantee zero cross-tenant or cross-context collisions.
   */
  public buildCacheKey(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    query: AnalyticsQueryDto;
  }): string {
    const {
      organizationId,
      userId = 'anon',
      userPermissions = [],
      query,
    } = params;
    const permsHash = crypto
      .createHash('sha256')
      .update([...userPermissions].sort().join(','))
      .digest('hex')
      .substring(0, 16);

    const queryNormalized = {
      def: query.definitionKey,
      dims: [...(query.dimensions ?? [])].sort(),
      meas: [...(query.measures ?? [])]
        .map((m) => (typeof m === 'string' ? m : `${m.aggregation}(${m.name})`))
        .sort(),
      filter: query.filterAst ?? null,
      timeDim: query.timeDimension ?? null,
      timeGran: query.timeGranularity ?? null,
      tz: query.timeZone ?? 'UTC',
      lim: query.limit ?? 50,
      off: query.offset ?? 0,
      sort: query.sortBy ?? null,
      dir: query.sortDirection ?? 'asc',
    };

    const queryHash = crypto
      .createHash('sha256')
      .update(JSON.stringify(queryNormalized))
      .digest('hex')
      .substring(0, 16);

    return `analytics:${organizationId}:${userId}:${permsHash}:${query.definitionKey}:${queryHash}`;
  }

  /**
   * Validates query syntax and catalog bounds against the definition registry.
   */
  public validateQuery(
    query: AnalyticsQueryDto,
    userPermissions?: string[],
  ): AnalyticsDefinitionRecord {
    const definition = AnalyticsDefinitionRegistry.get(query.definitionKey);
    if (!definition) {
      throw new NotFoundException(
        `Analytics definition "${query.definitionKey}" not found (INV-501)`,
      );
    }

    // Check permissions (INV-504)
    if (
      userPermissions !== undefined &&
      definition.requiredPermissions.length > 0
    ) {
      const hasPermission = definition.requiredPermissions.some(
        (perm) =>
          userPermissions.includes(perm) ||
          userPermissions.includes('analytics.admin'),
      );
      if (!hasPermission) {
        throw new ForbiddenException(
          `User lacks required permission for dataset "${query.definitionKey}" (INV-504)`,
        );
      }
    }

    // Validate dimensions (INV-505, INV-509)
    if (query.dimensions) {
      if (query.dimensions.length > AST_BOUNDS.MAX_DIMENSIONS) {
        throw new BadRequestException(
          `Cannot specify more than ${AST_BOUNDS.MAX_DIMENSIONS} dimensions (INV-509)`,
        );
      }
      for (const dim of query.dimensions) {
        if (!definition.allowedDimensions.includes(dim)) {
          throw new BadRequestException(
            `Dimension "${dim}" is not allowed for dataset "${query.definitionKey}" (INV-505)`,
          );
        }
      }
    }

    // Validate measures (INV-506, INV-507, INV-509)
    if (query.measures) {
      if (query.measures.length > AST_BOUNDS.MAX_MEASURES) {
        throw new BadRequestException(
          `Cannot specify more than ${AST_BOUNDS.MAX_MEASURES} measures (INV-509)`,
        );
      }
      for (const measureItem of query.measures) {
        const allowedMeasure = definition.allowedMeasures.find(
          (m) => m.name === measureItem.name,
        );
        if (!allowedMeasure) {
          throw new BadRequestException(
            `Measure "${measureItem.name}" is not allowed for dataset "${query.definitionKey}" (INV-506)`,
          );
        }
        if (!allowedMeasure.aggregations.includes(measureItem.aggregation)) {
          throw new BadRequestException(
            `Aggregation "${measureItem.aggregation}" is not supported for measure "${measureItem.name}" (INV-507)`,
          );
        }
      }
    }

    // Validate time dimension if supplied (INV-505, INV-513)
    if (query.timeDimension) {
      if (!definition.allowedTimeDimensions.includes(query.timeDimension)) {
        throw new BadRequestException(
          `Time dimension "${query.timeDimension}" is not allowed for dataset "${query.definitionKey}" (INV-505)`,
        );
      }
    }

    // Validate Filter AST (INV-508, INV-509, INV-510)
    if (query.filterAst) {
      try {
        validateFilterAst(query.filterAst, definition.allowedFilterFields);
      } catch (err) {
        if (err instanceof AstValidationError) {
          throw new BadRequestException(err.message);
        }
        throw err;
      }
    }

    // Validate pagination (INV-511)
    const limit = query.limit ?? 50;
    if (limit < 1 || limit > 1000) {
      throw new BadRequestException(
        'Query limit must be between 1 and 1000 (INV-511)',
      );
    }
    const offset = query.offset ?? 0;
    if (offset < 0) {
      throw new BadRequestException(
        'Query offset must be non-negative (INV-511)',
      );
    }

    // Validate sorting (INV-512)
    if (query.sortBy) {
      const allowedSortFields = [
        ...definition.allowedDimensions,
        ...definition.allowedMeasures.map((m) => m.name),
        ...definition.allowedFilterFields,
      ];
      if (!allowedSortFields.includes(query.sortBy)) {
        throw new BadRequestException(
          `Sort field "${query.sortBy}" is not allowed for dataset "${query.definitionKey}" (INV-505)`,
        );
      }
    }

    // Validate timezone policy (INV-513)
    this.timeService.validateTimeZone(query.timeZone || 'UTC');

    return definition;
  }

  /**
   * Executes an analytics query with full tenant isolation and minor-unit financial arithmetic.
   */
  public async execute(params: {
    organizationId: string;
    userId?: string;
    userPermissions?: string[];
    query: AnalyticsQueryDto;
  }): Promise<AnalyticsQueryResult> {
    const startTime = Date.now();
    const { organizationId, userId, userPermissions = [], query } = params;

    const definition = this.validateQuery(query, userPermissions);

    // INV-523: Cache lookup with multi-dimensional tenant/security key
    const cacheKey = this.buildCacheKey(params);
    if (this.cacheService) {
      const cached = await Promise.resolve(
        this.cacheService.get<AnalyticsQueryResult>(cacheKey),
      );
      if (cached) {
        return {
          ...cached,
          cacheHit: true,
        };
      }
    }

    // Build Prisma where clause safely with strict tenant isolation (INV-503)
    const where: Record<string, unknown> = {};

    if (query.filterAst) {
      const astCondition = this.compileAstToPrismaWhere(query.filterAst);
      if (astCondition) {
        Object.assign(where, astCondition);
      }
    }
    // Hard tenant scoping cannot be bypassed by any filter (INV-503)
    where.organizationId = organizationId;

    // Dimensions, measures, time settings
    const dimensions = query.dimensions ?? [];
    const measures =
      query.measures && query.measures.length > 0
        ? query.measures
        : [
            {
              name: definition.allowedMeasures[0]?.name ?? 'count',
              aggregation:
                definition.allowedMeasures[0]?.aggregations[0] ?? 'COUNT',
            },
          ];
    const timeDimension = query.timeDimension;
    const timeGranularity = query.timeGranularity;
    const timeZone = query.timeZone || 'UTC';
    const limit = Math.min(query.limit ?? 50, 1000);
    const offset = Math.max(query.offset ?? 0, 0);

    // Execute aggregation query against domain dataset
    const rawRows = await this.fetchDomainRecords(definition.modelName, where);

    // Perform deterministic in-memory aggregation and bucketing
    const aggregated = this.aggregateRecords({
      records: rawRows,
      dimensions,
      measures,
      timeDimension,
      timeGranularity,
      timeZone,
      definition,
    });

    // Deterministic sorting with secondary tie-breaker (INV-512)
    const sortBy = query.sortBy;
    const sortDir = query.sortDirection ?? 'asc';
    aggregated.sort((a, b) => {
      if (sortBy) {
        const valA = a[sortBy] ?? 0;
        const valB = b[sortBy] ?? 0;
        if (typeof valA === 'number' && typeof valB === 'number') {
          if (valA !== valB) {
            return sortDir === 'asc' ? valA - valB : valB - valA;
          }
        } else {
          const strA = safeStringify(valA);
          const strB = safeStringify(valB);
          const cmp = strA.localeCompare(strB);
          if (cmp !== 0) {
            return sortDir === 'asc' ? cmp : -cmp;
          }
        }
      }
      const tieA = safeStringify(dimensions.map((d) => a[d]));
      const tieB = safeStringify(dimensions.map((d) => b[d]));
      return tieA.localeCompare(tieB);
    });

    const totalRows = aggregated.length;
    const pagedData = aggregated.slice(offset, offset + limit);
    const executionTimeMs = Date.now() - startTime;

    // Record usage telemetry (INV-515)
    this.usageRepo
      .recordEvent({
        organizationId,
        userId,
        eventType: 'analytics.query.executed',
        resourceType: 'dataset',
        resourceId: definition.definitionKey,
        durationMs: executionTimeMs,
        rowCount: pagedData.length,
        metadata: {
          dimensions,
          measures: measures.map((m) => `${m.aggregation}(${m.name})`),
          hasFilterAst: !!query.filterAst,
          totalRows,
        },
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Failed to record analytics usage event: ${message}`);
      });

    const result: AnalyticsQueryResult = {
      data: pagedData,
      meta: {
        definitionKey: definition.definitionKey,
        dimensions,
        measures: measures.map((m) => `${m.aggregation}(${m.name})`),
        totalRows,
        executionTimeMs,
        timeDimension,
        timeGranularity,
        timeZone,
        limit,
        offset,
      },
      cacheHit: false,
    };

    if (this.cacheService) {
      await Promise.resolve(this.cacheService.set(cacheKey, result, 60));
    }

    return result;
  }

  /**
   * Safely transforms Filter AST into Prisma where conditions.
   * Ensures no user code or raw SQL is generated (INV-510, INV-518).
   */
  public compileAstToPrismaWhere(
    node: FilterNode,
  ): Record<string, unknown> | null {
    if (node.and && Array.isArray(node.and)) {
      const conditions = node.and
        .map((child) => this.compileAstToPrismaWhere(child))
        .filter((c): c is Record<string, unknown> => c !== null);
      return conditions.length > 0 ? { AND: conditions } : null;
    }

    if (node.or && Array.isArray(node.or)) {
      const conditions = node.or
        .map((child) => this.compileAstToPrismaWhere(child))
        .filter((c): c is Record<string, unknown> => c !== null);
      return conditions.length > 0 ? { OR: conditions } : null;
    }

    if (node.not) {
      const notCondition = this.compileAstToPrismaWhere(node.not);
      return notCondition ? { NOT: notCondition } : null;
    }

    if (!node.field || !node.operator) {
      return null;
    }

    const field = node.field;
    const val = node.value;

    // Reject reserved or unsafe fields (INV-503, INV-510)
    if (
      field === 'organizationId' ||
      field === '__proto__' ||
      field === 'constructor' ||
      field === 'prototype'
    ) {
      return null;
    }

    switch (node.operator) {
      case 'eq':
        return { [field]: val };
      case 'neq':
        return { [field]: { not: val } };
      case 'gt':
        return { [field]: { gt: val } };
      case 'gte':
        return { [field]: { gte: val } };
      case 'lt':
        return { [field]: { lt: val } };
      case 'lte':
        return { [field]: { lte: val } };
      case 'in':
        return { [field]: { in: Array.isArray(val) ? val : [val] } };
      case 'contains':
        return { [field]: { contains: String(val), mode: 'insensitive' } };
      case 'between': {
        if (Array.isArray(val) && val.length === 2) {
          const [minVal, maxVal] = val as [unknown, unknown];
          return { [field]: { gte: minVal, lte: maxVal } };
        }
        return null;
      }
      case 'isNull':
        return { [field]: null };
      case 'isNotNull':
        return { [field]: { not: null } };
      default:
        return null;
    }
  }

  /**
   * Fetches records from the corresponding Prisma delegate safely.
   */
  private async fetchDomainRecords(
    modelName: string,
    where: Record<string, unknown>,
  ): Promise<Record<string, unknown>[]> {
    const prismaDelegateMap = this.prisma as unknown as Record<
      string,
      {
        findMany?: (args: {
          where: Record<string, unknown>;
          take: number;
        }) => Promise<Record<string, unknown>[]>;
      }
    >;
    const delegate = prismaDelegateMap[modelName];
    if (delegate && typeof delegate.findMany === 'function') {
      try {
        return await delegate.findMany({
          where,
          take: 5000,
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger.debug(
          `Prisma findMany fallback on ${modelName}: ${error.message}`,
        );
      }
    }
    return [];
  }

  /**
   * In-memory aggregation engine with strict minor-unit integer precision for financial measures.
   * INV-507: zero floating-point rounding drift.
   */
  public aggregateRecords(params: {
    records: Record<string, unknown>[];
    dimensions: string[];
    measures: {
      name: string;
      aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    }[];
    timeDimension?: string;
    timeGranularity?: string;
    timeZone: string;
    definition: AnalyticsDefinitionRecord;
  }): Record<string, unknown>[] {
    const {
      records,
      dimensions,
      measures,
      timeDimension,
      timeGranularity,
      timeZone,
      definition,
    } = params;

    const groups = new Map<
      string,
      {
        groupKeyValues: Record<string, unknown>;
        records: Record<string, unknown>[];
      }
    >();

    for (const record of records) {
      const keyParts: string[] = [];
      const groupKeyValues: Record<string, unknown> = {};

      for (const dim of dimensions) {
        const val = safeStringify(record[dim]);
        keyParts.push(`${dim}=${val}`);
        groupKeyValues[dim] = record[dim];
      }

      if (timeDimension && timeGranularity && record[timeDimension]) {
        const bucket = this.timeService.bucketTimestamp(
          record[timeDimension] as Date | string,
          timeGranularity as TimeGranularity,
          timeZone,
        );
        keyParts.push(`time=${bucket}`);
        groupKeyValues[timeDimension] = bucket;
      }

      const compositeKey = keyParts.length > 0 ? keyParts.join('|') : '__ALL__';

      if (!groups.has(compositeKey)) {
        groups.set(compositeKey, {
          groupKeyValues,
          records: [],
        });
      }

      groups.get(compositeKey)!.records.push(record);
    }

    // Compute aggregated measures for each group
    const results: Record<string, unknown>[] = [];

    for (const group of groups.values()) {
      const row: Record<string, unknown> = { ...group.groupKeyValues };

      for (const measureItem of measures) {
        const measureDef = definition.allowedMeasures.find(
          (m) => m.name === measureItem.name,
        );
        const isCurrency = measureDef?.isCurrency === true;
        const resultKey = `${measureItem.aggregation.toLowerCase()}_${measureItem.name}`;

        row[resultKey] = this.computeMeasureAggregation({
          records: group.records,
          fieldName: measureItem.name,
          aggregation: measureItem.aggregation,
          isCurrency,
        });
      }

      results.push(row);
    }

    return results;
  }

  /**
   * Computes a single measure aggregation across a group of records.
   * Applies exact integer math (minor units) if isCurrency is true.
   */
  private computeMeasureAggregation(params: {
    records: Record<string, unknown>[];
    fieldName: string;
    aggregation: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
    isCurrency: boolean;
  }): number {
    const { records, fieldName, aggregation, isCurrency } = params;

    if (aggregation === 'COUNT') {
      return records.length;
    }

    const values: number[] = [];
    for (const r of records) {
      const raw = r[fieldName];
      if (raw !== undefined && raw !== null) {
        const num = Number(raw);
        if (!isNaN(num)) {
          values.push(num);
        }
      }
    }

    if (values.length === 0) {
      return 0;
    }

    if (isCurrency) {
      // Minor-unit integer arithmetic (cents) to avoid floating-point errors (INV-507)
      let sumMinor = 0n;
      for (const v of values) {
        sumMinor += BigInt(Math.round(v));
      }

      switch (aggregation) {
        case 'SUM':
          return Number(sumMinor);
        case 'AVG':
          return Number(sumMinor / BigInt(values.length));
        case 'MIN':
          return Math.min(...values);
        case 'MAX':
          return Math.max(...values);
      }
    }

    // Standard numeric calculations
    switch (aggregation) {
      case 'SUM':
        return values.reduce((acc, curr) => acc + curr, 0);
      case 'AVG':
        return (
          Math.round(
            (values.reduce((acc, curr) => acc + curr, 0) / values.length) * 100,
          ) / 100
        );
      case 'MIN':
        return Math.min(...values);
      case 'MAX':
        return Math.max(...values);
      default:
        return 0;
    }
  }
}
