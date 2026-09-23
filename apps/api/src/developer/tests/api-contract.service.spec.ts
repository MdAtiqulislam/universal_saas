import { Test, TestingModule } from '@nestjs/testing';
import { ApiContractService } from '../services/api-contract.service';
import { NotFoundException } from '@nestjs/common';

describe('ApiContractService (M41)', () => {
  let service: ApiContractService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiContractService],
    }).compile();

    service = module.get<ApiContractService>(ApiContractService);
  });

  it('should list all registered public endpoints', () => {
    const endpoints = service.listEndpoints();
    expect(endpoints.length).toBeGreaterThan(0);
    const crmEndpoints = service.listEndpoints('CRM');
    expect(crmEndpoints.length).toBeGreaterThan(0);
    crmEndpoints.forEach((ep) => expect(ep.category).toBe('CRM'));
  });

  it('should find an endpoint by ID', () => {
    const ep = service.getEndpointById('crm-customers-list');
    expect(ep).toBeDefined();
    expect(ep.path).toBe('/api/v1/crm/customers');
    expect(ep.method).toBe('GET');
  });

  it('should throw NotFoundException for invalid endpoint ID', () => {
    expect(() => service.getEndpointById('non-existent-endpoint')).toThrow(
      NotFoundException,
    );
  });

  it('should find endpoint by method and path', () => {
    const ep = service.findEndpointByMethodAndPath(
      'GET',
      '/api/v1/crm/customers',
    );
    expect(ep).toBeDefined();
    expect(ep?.id).toBe('crm-customers-list');
  });

  it('should generate a valid OpenAPI 3.0.3 specification', () => {
    const spec = service.getOpenApiSpec() as any;
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info).toBeDefined();
    expect(spec.info.title).toContain('Universal Business Operations');
    expect(spec.paths).toBeDefined();
    expect(spec.components.securitySchemes.ApiKeyAuth).toBeDefined();
    expect(spec.components.securitySchemes.BearerAuth).toBeDefined();
    expect(spec.paths['/api/v1/crm/customers']).toBeDefined();
  });

  it('should return error taxonomy with standard error codes', () => {
    const taxonomy = service.getErrorTaxonomy();
    expect(Object.keys(taxonomy).length).toBeGreaterThan(0);
    expect(taxonomy['INVALID_API_KEY']).toBeDefined();
    expect(taxonomy['INVALID_API_KEY'].httpStatus).toBe(401);
    expect(taxonomy['RATE_LIMIT_EXCEEDED']).toBeDefined();
    expect(taxonomy['RATE_LIMIT_EXCEEDED'].httpStatus).toBe(429);
  });
});
