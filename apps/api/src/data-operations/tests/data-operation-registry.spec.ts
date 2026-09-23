import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataOperationRegistryService } from '../registry/data-operation.registry';
import { DataOperationType } from '@prisma/client';

describe('DataOperationRegistryService', () => {
  let registry: DataOperationRegistryService;

  beforeEach(() => {
    registry = new DataOperationRegistryService();
  });

  // INV-526: Globally unique by authoritative operation key
  it('INV-526: should enforce uniqueness of operation key', () => {
    expect(() =>
      registry.register({
        operationKey: 'crm.customer.export', // already registered in constructor
        domain: 'crm',
        entity: 'customer',
        operationType: DataOperationType.EXPORT,
        allowedFormats: ['CSV'],
        requiredPermissions: ['crm.customers.view'],
        restrictedFieldPermissions: {},
        fieldSchema: [{ name: 'name', type: 'string' }],
        maxRows: 1000,
        maxFileSize: 1024 * 1024,
        maxColumns: 10,
        validationRules: [],
        transformationRules: [],
        identityStrategy: ['email'],
        supportedModes: [],
        modelName: 'customer',
      }),
    ).toThrow(ConflictException);
  });

  it('should retrieve registered operations by key', () => {
    const op = registry.get('crm.customer.export');
    expect(op).toBeDefined();
    expect(op.domain).toBe('crm');
    expect(op.entity).toBe('customer');
  });

  it('should throw NotFoundException for unregistered key', () => {
    expect(() => registry.get('nonexistent.operation.key')).toThrow(
      NotFoundException,
    );
  });

  it('should list operations with optional domain filter', () => {
    const crmOps = registry.list({ domain: 'crm' });
    expect(crmOps.length).toBeGreaterThanOrEqual(2);
    expect(crmOps.every((o) => o.domain === 'crm')).toBe(true);
  });

  it('INV-537: accepts only immutable declarative allowlisted rules', () => {
    const definition: any = {
      ...registry.get('crm.customer.import'),
      operationKey: 'test.declarative.import',
      transformationRules: [{ field: 'name', rule: 'TRIM' }],
    };
    registry.register(definition);
    const registered = registry.get(definition.operationKey);
    expect(registered.transformationRules[0]).toEqual({ field: 'name', rule: 'TRIM' });
    expect(Object.isFrozen(registered)).toBe(true);
    expect(Object.isFrozen(registered.transformationRules)).toBe(true);
    expect(() => registry.register({ ...definition, operationKey: 'test.unknown', transformationRules: [{ field: 'name', rule: 'EXECUTE' }] } as any)).toThrow(BadRequestException);
    expect(() => registry.register({ ...definition, operationKey: 'test.function', transformationRules: [{ field: 'name', rule: 'TRIM', param: () => 'bad' }] } as any)).toThrow(BadRequestException);
    expect(() => registry.register({ ...definition, operationKey: 'test.expression', transformationRules: [{ field: 'name', rule: 'TRIM', param: 'process.exit()' }] } as any)).toThrow(BadRequestException);
    expect(() => registry.register({ ...definition, operationKey: 'test.prototype', transformationRules: [{ field: 'name', rule: 'TRIM', param: JSON.parse('{"__proto__":{"polluted":true}}') }] } as any)).toThrow(BadRequestException);
  });

  // INV-531 / INV-532: Field allowlist validation
  it('INV-531/INV-532: should validate field selection against authoritative schema', () => {
    // Valid fields
    expect(() =>
      registry.validateFieldSelection('crm.customer.export', ['name', 'email']),
    ).not.toThrow();

    // Unknown field
    expect(() =>
      registry.validateFieldSelection('crm.customer.export', [
        'name',
        'unknown_field',
      ]),
    ).toThrow(BadRequestException);
  });

  // INV-533: Restricted fields require elevated permissions
  it('INV-533: should enforce elevated permissions for restricted fields', () => {
    // taxId is restricted on crm.customer.export
    expect(() =>
      registry.assertFieldPermissions(
        'crm.customer.export',
        ['taxId'],
        ['crm.customers.view'],
      ),
    ).toThrow(ForbiddenException);

    // With elevated permission
    expect(() =>
      registry.assertFieldPermissions(
        'crm.customer.export',
        ['taxId'],
        ['crm.customers.view', 'data_operations.restricted_fields.export'],
      ),
    ).not.toThrow();

    // Global admin bypass
    expect(() =>
      registry.assertFieldPermissions(
        'crm.customer.export',
        ['taxId'],
        ['data_operations.admin'],
      ),
    ).not.toThrow();
  });
});
