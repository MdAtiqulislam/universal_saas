import { Test, TestingModule } from '@nestjs/testing';
import { ApiExplorerService } from '../services/api-explorer.service';
import { ApiContractService } from '../services/api-contract.service';
import { ApiUsageService } from '../services/api-usage.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ApiExplorerService (M41)', () => {
  let service: ApiExplorerService;
  let usageService: { recordUsage: jest.Mock };

  beforeEach(async () => {
    usageService = {
      recordUsage: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiExplorerService,
        ApiContractService,
        { provide: ApiUsageService, useValue: usageService },
        { provide: StructuredLoggingService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    service = module.get<ApiExplorerService>(ApiExplorerService);
  });

  it('should reject execution of an unregistered endpoint ID', async () => {
    await expect(
      service.executeRequest('org-123', 'user-1', {
        endpointId: 'unknown-endpoint-id',
        method: 'GET',
        path: '/api/v1/unknown',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should reject execution if method does not match endpoint definition', async () => {
    await expect(
      service.executeRequest('org-123', 'user-1', {
        endpointId: 'crm-customers-list',
        method: 'POST',
        path: '/api/v1/crm/customers',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject execution when arbitrary external host or loopback is in path (SSRF defense)', async () => {
    await expect(
      service.executeRequest('org-123', 'user-1', {
        endpointId: 'crm-customers-list',
        method: 'GET',
        path: 'http://169.254.169.254/latest/meta-data',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should successfully execute a valid endpoint within tenant boundary and record usage', async () => {
    const result = await service.executeRequest('org-123', 'user-1', {
      endpointId: 'crm-customers-list',
      method: 'GET',
      path: '/api/v1/crm/customers',
      queryParams: { limit: 10 },
    });

    expect(result.statusCode).toBe(200);
    expect(result.endpointId).toBe('crm-customers-list');
    expect(result.responseHeaders['x-tenant-id']).toBe('org-123');
    expect(result.responseHeaders['x-api-version']).toBe('v1');
    expect(result.responseBody).toBeDefined();
    expect(usageService.recordUsage).toHaveBeenCalledTimes(1);
    expect(usageService.recordUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-123',
        route: '/api/v1/crm/customers',
        statusCode: 200,
      }),
    );
  });
});
