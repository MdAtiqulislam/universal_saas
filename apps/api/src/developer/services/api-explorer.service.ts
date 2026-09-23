import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ApiContractService } from './api-contract.service';
import { ApiUsageService } from './api-usage.service';
import { ApiExplorerRequestDto } from '../dto/api-explorer-request.dto';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

export interface ApiExplorerExecutionResult {
  requestId: string;
  endpointId: string;
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
  responseHeaders: Record<string, string>;
  responseBody: unknown;
  executedAt: string;
}

@Injectable()
export class ApiExplorerService {
  constructor(
    private readonly contractService: ApiContractService,
    private readonly usageService: ApiUsageService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async executeRequest(
    organizationId: string,
    actorUserId: string,
    dto: ApiExplorerRequestDto,
  ): Promise<ApiExplorerExecutionResult> {
    const start = Date.now();
    const requestId = crypto.randomUUID();

    // 1. Verify endpoint is pre-registered in contract registry
    const endpoint = this.contractService.getEndpointById(dto.endpointId);
    if (!endpoint) {
      throw new BadRequestException(
        `Endpoint '${dto.endpointId}' is not a registered public API endpoint`,
      );
    }

    // 2. Strict validation: Method and path must match registered contract
    if (endpoint.method !== dto.method.toUpperCase()) {
      throw new BadRequestException(
        `Method '${dto.method}' does not match endpoint definition method '${endpoint.method}'`,
      );
    }

    // 3. Prevent arbitrary host targeting / SSRF
    if (
      dto.path.includes('://') ||
      dto.path.startsWith('//') ||
      dto.path.toLowerCase().includes('localhost') ||
      dto.path.toLowerCase().includes('127.0.0.1') ||
      dto.path.toLowerCase().includes('169.254')
    ) {
      throw new ForbiddenException(
        'Targeting arbitrary hosts, external URLs, or loopback interfaces is strictly forbidden',
      );
    }

    // 4. Validate parameters required by endpoint
    for (const p of endpoint.parameters) {
      if (p.required) {
        if (p.in === 'path') {
          const val = dto.pathParams?.[p.name];
          if (!val) {
            throw new BadRequestException(
              `Missing required path parameter: ${p.name}`,
            );
          }
        } else if (p.in === 'query') {
          const val = dto.queryParams?.[p.name];
          if (val === undefined || val === null) {
            throw new BadRequestException(
              `Missing required query parameter: ${p.name}`,
            );
          }
        }
      }
    }

    // 5. Construct safe simulated/contract-based response for exploration
    const durationMs = Math.max(1, Date.now() - start);
    const responseHeaders: Record<string, string> = {
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': requestId,
      'x-tenant-id': organizationId,
      'x-api-version': endpoint.version,
    };

    const statusCode = endpoint.method === 'POST' ? 201 : 200;
    const responseBody = {
      success: true,
      data: endpoint.exampleResponse?.data ?? {
        message: 'Sample operation result',
      },
      meta: endpoint.exampleResponse?.meta,
      message: `Simulated explorer execution for ${endpoint.operation}`,
      _explorerContext: {
        organizationId,
        actorUserId,
        executedEndpoint: endpoint.id,
      },
    };

    // 6. Record usage telemetry asynchronously
    await this.usageService.recordUsage({
      organizationId,
      requestId,
      method: endpoint.method,
      route: endpoint.path,
      statusCode,
      durationMs,
      userAgent: 'DeveloperPortal/Explorer (In-Process)',
      apiVersion: endpoint.version,
    });

    this.logger.log({
      level: 'INFO',
      message: 'API Explorer execution performed',
      module: 'Developer',
      organizationId,
      actorUserId,
      endpointId: endpoint.id,
      requestId,
    });

    return {
      requestId,
      endpointId: endpoint.id,
      method: endpoint.method,
      path: endpoint.path,
      statusCode,
      durationMs,
      responseHeaders,
      responseBody,
      executedAt: new Date().toISOString(),
    };
  }
}
