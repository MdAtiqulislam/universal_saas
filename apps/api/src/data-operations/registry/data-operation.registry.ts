import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import {
  DataOperationType,
  DataImportMode,
  DataDuplicateStrategy,
} from '@prisma/client';

export type FieldType =
  'string' | 'number' | 'boolean' | 'date' | 'currency_cents' | 'enum';

export interface FieldSchemaDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  isRestricted?: boolean;
  allowedValues?: string[];
  description?: string;
  defaultValue?: unknown;
}

export interface ValidationRuleDefinition {
  field: string;
  rule: 'regex' | 'min' | 'max' | 'email' | 'enum' | 'custom';
  param?: unknown;
  message: string;
}

export const DECLARATIVE_TRANSFORMATION_RULES = [
  'TRIM',
  'LOWERCASE',
  'UPPERCASE',
  'TO_CENTS',
  'PARSE_DATE',
  'NORMALIZE_PHONE',
  'DEFAULT_VALUE',
] as const;

export type DeclarativeTransformationRule =
  (typeof DECLARATIVE_TRANSFORMATION_RULES)[number];

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

export interface TransformationRuleDefinition {
  field: string;
  rule: DeclarativeTransformationRule;
  param?: unknown;
}

export interface DataOperationDefinition {
  operationKey: string;
  domain: string;
  entity: string;
  operationType: DataOperationType;
  allowedFormats: ('CSV' | 'JSON')[];
  requiredPermissions: string[];
  restrictedFieldPermissions: Record<string, string>;
  fieldSchema: FieldSchemaDefinition[];
  maxRows: number;
  maxFileSize: number; // bytes
  maxColumns: number;
  validationRules: ValidationRuleDefinition[];
  transformationRules: TransformationRuleDefinition[];
  identityStrategy: string[]; // identity key(s) for duplicate resolution
  supportedModes: DataImportMode[];
  duplicateStrategy?: DataDuplicateStrategy;
  modelName: string; // Prisma model name
}

@Injectable()
export class DataOperationRegistryService {
  private readonly operations = new Map<string, DataOperationDefinition>();

  constructor() {
    this.registerAuthoritativeOperations();
  }

  /**
   * Registers a data operation definition.
   * INV-526: Authoritative operationKey must be globally unique.
   */
  register(def: DataOperationDefinition): void {
    if (this.operations.has(def.operationKey)) {
      throw new ConflictException(
        `Data operation with key "${def.operationKey}" is already registered.`,
      );
    }
    this.validateTransformationRules(def);
    this.operations.set(def.operationKey, deepFreeze(def));
  }

  private validateTransformationRules(def: DataOperationDefinition): void {
    const allowed = new Set<string>(DECLARATIVE_TRANSFORMATION_RULES);
    for (const rule of def.transformationRules) {
      if (!rule || typeof rule !== 'object' || typeof rule.field !== 'string') {
        throw new BadRequestException('Transformation definitions must be declarative objects.');
      }
      if (!allowed.has(rule.rule)) {
        throw new BadRequestException(`Unknown transformation rule "${String(rule.rule)}".`);
      }
      if (Object.keys(rule).some((key) => !['field', 'rule', 'param'].includes(key))) {
        throw new BadRequestException('Transformation definitions contain unsupported properties.');
      }
      if (rule.param !== undefined && rule.rule !== 'DEFAULT_VALUE') {
        throw new BadRequestException('Only DEFAULT_VALUE may declare a transformation parameter.');
      }
      if (typeof rule.param === 'function' || (rule.param && typeof rule.param === 'object' &&
          ['constructor', '__proto__', 'prototype'].some((key) => Object.prototype.hasOwnProperty.call(rule.param, key)))) {
        throw new BadRequestException('Transformation parameters cannot contain executable or prototype-pollution payloads.');
      }
    }
  }

  /**
   * Retrieves an authoritative operation definition by key.
   */
  get(operationKey: string): DataOperationDefinition {
    const op = this.operations.get(operationKey);
    if (!op) {
      throw new NotFoundException(
        `Data operation "${operationKey}" not found in authoritative registry.`,
      );
    }
    return op;
  }

  has(operationKey: string): boolean {
    return this.operations.has(operationKey);
  }

  list(filter?: {
    domain?: string;
    operationType?: DataOperationType;
  }): DataOperationDefinition[] {
    let list = Array.from(this.operations.values());
    if (filter?.domain) {
      list = list.filter((op) => op.domain === filter.domain);
    }
    if (filter?.operationType) {
      list = list.filter((op) => op.operationType === filter.operationType);
    }
    return list;
  }

  /**
   * Enforces INV-531 / INV-532: All selected/provided fields must exist in the authoritative allowlist.
   */
  validateFieldSelection(operationKey: string, fields: string[]): void {
    const def = this.get(operationKey);
    const allowlist = new Set(def.fieldSchema.map((f) => f.name));
    for (const field of fields) {
      if (!allowlist.has(field)) {
        throw new BadRequestException(
          `Field "${field}" is not in the authoritative allowlist for operation "${operationKey}".`,
        );
      }
    }
  }

  /**
   * Enforces INV-533: Restricted fields cannot be accessed without required elevated permissions.
   */
  assertFieldPermissions(
    operationKey: string,
    requestedFields: string[],
    userPermissions: string[] = [],
  ): void {
    const def = this.get(operationKey);
    const permSet = new Set(userPermissions);

    // Global admin bypasses granular field checks
    if (
      permSet.has('data_operations.admin') ||
      permSet.has('data_operations.restricted_fields.export')
    ) {
      return;
    }

    for (const field of requestedFields) {
      const requiredPerm = def.restrictedFieldPermissions[field];
      if (requiredPerm && !permSet.has(requiredPerm)) {
        throw new ForbiddenException(
          `Exporting restricted field "${field}" requires permission "${requiredPerm}".`,
        );
      }
    }
  }

  /**
   * Initializes authoritative built-in operations for core domains.
   */
  private registerAuthoritativeOperations(): void {
    // 1. CRM Customer Export
    this.register({
      operationKey: 'crm.customer.export',
      domain: 'crm',
      entity: 'customer',
      operationType: DataOperationType.EXPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'crm.customers.view',
        'data_operations.export.execute',
      ],
      restrictedFieldPermissions: {
        taxId: 'data_operations.restricted_fields.export',
        ssn: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        { name: 'id', type: 'string', description: 'Customer UUID' },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Customer legal name',
        },
        {
          name: 'email',
          type: 'string',
          required: true,
          description: 'Primary contact email',
        },
        { name: 'phone', type: 'string', description: 'Phone number' },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'PROSPECT'],
        },
        {
          name: 'taxId',
          type: 'string',
          isRestricted: true,
          description: 'Tax ID (Restricted)',
        },
        { name: 'createdAt', type: 'date', description: 'Creation timestamp' },
      ],
      maxRows: 50000,
      maxFileSize: 25 * 1024 * 1024,
      maxColumns: 50,
      validationRules: [],
      transformationRules: [],
      identityStrategy: ['email'],
      supportedModes: [],
      modelName: 'customer',
    });

    // 2. CRM Customer Import
    this.register({
      operationKey: 'crm.customer.import',
      domain: 'crm',
      entity: 'customer',
      operationType: DataOperationType.IMPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'crm.customers.manage',
        'data_operations.import.execute',
      ],
      restrictedFieldPermissions: {
        taxId: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Customer legal name',
        },
        {
          name: 'email',
          type: 'string',
          required: true,
          unique: true,
          description: 'Primary email',
        },
        { name: 'phone', type: 'string', description: 'Phone number' },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'PROSPECT'],
          defaultValue: 'ACTIVE',
        },
        {
          name: 'taxId',
          type: 'string',
          isRestricted: true,
          description: 'Tax identification',
        },
      ],
      maxRows: 10000,
      maxFileSize: 15 * 1024 * 1024,
      maxColumns: 30,
      validationRules: [
        {
          field: 'email',
          rule: 'email',
          message: 'Must be a valid email address',
        },
      ],
      transformationRules: [
        { field: 'name', rule: 'TRIM' },
        { field: 'email', rule: 'LOWERCASE' },
        { field: 'email', rule: 'TRIM' },
        { field: 'phone', rule: 'NORMALIZE_PHONE' },
      ],
      identityStrategy: ['email'],
      supportedModes: [
        DataImportMode.CREATE_ONLY,
        DataImportMode.UPDATE_ONLY,
        DataImportMode.UPSERT,
      ],
      duplicateStrategy: DataDuplicateStrategy.UPDATE,
      modelName: 'customer',
    });

    // 3. Inventory Item Export
    this.register({
      operationKey: 'inventory.item.export',
      domain: 'inventory',
      entity: 'inventoryItem',
      operationType: DataOperationType.EXPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'inventory.items.view',
        'data_operations.export.execute',
      ],
      restrictedFieldPermissions: {
        costPriceCents: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        { name: 'id', type: 'string', description: 'Inventory Item ID' },
        {
          name: 'sku',
          type: 'string',
          required: true,
          description: 'Stock Keeping Unit',
        },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Item name',
        },
        { name: 'quantity', type: 'number', description: 'On-hand quantity' },
        {
          name: 'reservedQuantity',
          type: 'number',
          description: 'Reserved quantity',
        },
        {
          name: 'costPriceCents',
          type: 'currency_cents',
          isRestricted: true,
          description: 'Unit cost price in cents',
        },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
        },
      ],
      maxRows: 50000,
      maxFileSize: 25 * 1024 * 1024,
      maxColumns: 40,
      validationRules: [],
      transformationRules: [],
      identityStrategy: ['sku'],
      supportedModes: [],
      modelName: 'inventoryItem',
    });

    // 4. Inventory Item Import
    this.register({
      operationKey: 'inventory.item.import',
      domain: 'inventory',
      entity: 'inventoryItem',
      operationType: DataOperationType.IMPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'inventory.items.manage',
        'data_operations.import.execute',
      ],
      restrictedFieldPermissions: {
        costPriceCents: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        {
          name: 'sku',
          type: 'string',
          required: true,
          unique: true,
          description: 'Stock Keeping Unit',
        },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Item name',
        },
        {
          name: 'quantity',
          type: 'number',
          required: true,
          description: 'On-hand quantity',
        },
        {
          name: 'reservedQuantity',
          type: 'number',
          defaultValue: 0,
          description: 'Reserved quantity',
        },
        {
          name: 'costPriceCents',
          type: 'currency_cents',
          isRestricted: true,
          description: 'Unit cost in cents',
        },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'DISCONTINUED'],
          defaultValue: 'ACTIVE',
        },
      ],
      maxRows: 10000,
      maxFileSize: 15 * 1024 * 1024,
      maxColumns: 30,
      validationRules: [
        {
          field: 'sku',
          rule: 'regex',
          param: '^[A-Z0-9_-]+$',
          message: 'SKU must be uppercase alphanumeric',
        },
        {
          field: 'quantity',
          rule: 'min',
          param: 0,
          message: 'Quantity cannot be negative',
        },
      ],
      transformationRules: [
        { field: 'sku', rule: 'UPPERCASE' },
        { field: 'sku', rule: 'TRIM' },
        { field: 'name', rule: 'TRIM' },
        { field: 'costPriceCents', rule: 'TO_CENTS' },
      ],
      identityStrategy: ['sku'],
      supportedModes: [
        DataImportMode.CREATE_ONLY,
        DataImportMode.UPDATE_ONLY,
        DataImportMode.UPSERT,
      ],
      duplicateStrategy: DataDuplicateStrategy.UPDATE,
      modelName: 'inventoryItem',
    });

    // 5. Sales Order Export
    this.register({
      operationKey: 'sales.order.export',
      domain: 'sales',
      entity: 'salesOrder',
      operationType: DataOperationType.EXPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'sales.orders.view',
        'data_operations.export.execute',
      ],
      restrictedFieldPermissions: {
        marginCents: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        { name: 'id', type: 'string', description: 'Order ID' },
        {
          name: 'orderNumber',
          type: 'string',
          required: true,
          description: 'Order Number',
        },
        { name: 'customerId', type: 'string', description: 'Customer UUID' },
        {
          name: 'status',
          type: 'enum',
          allowedValues: [
            'DRAFT',
            'CONFIRMED',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED',
          ],
        },
        {
          name: 'totalAmount',
          type: 'currency_cents',
          description: 'Total in cents',
        },
        {
          name: 'marginCents',
          type: 'currency_cents',
          isRestricted: true,
          description: 'Net margin in cents',
        },
        { name: 'createdAt', type: 'date', description: 'Order creation date' },
      ],
      maxRows: 50000,
      maxFileSize: 25 * 1024 * 1024,
      maxColumns: 50,
      validationRules: [],
      transformationRules: [],
      identityStrategy: ['orderNumber'],
      supportedModes: [],
      modelName: 'salesOrder',
    });

    // 6. Catalog Item Export
    this.register({
      operationKey: 'catalog.item.export',
      domain: 'catalog',
      entity: 'item',
      operationType: DataOperationType.EXPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'catalog.items.view',
        'data_operations.export.execute',
      ],
      restrictedFieldPermissions: {},
      fieldSchema: [
        { name: 'id', type: 'string', description: 'Item ID' },
        { name: 'sku', type: 'string', required: true, description: 'SKU' },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Item name',
        },
        {
          name: 'description',
          type: 'string',
          description: 'Item description',
        },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
        },
      ],
      maxRows: 50000,
      maxFileSize: 25 * 1024 * 1024,
      maxColumns: 30,
      validationRules: [],
      transformationRules: [],
      identityStrategy: ['sku'],
      supportedModes: [],
      modelName: 'item',
    });

    // 7. Catalog Item Import
    this.register({
      operationKey: 'catalog.item.import',
      domain: 'catalog',
      entity: 'item',
      operationType: DataOperationType.IMPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'catalog.items.manage',
        'data_operations.import.execute',
      ],
      restrictedFieldPermissions: {},
      fieldSchema: [
        {
          name: 'sku',
          type: 'string',
          required: true,
          unique: true,
          description: 'SKU',
        },
        {
          name: 'name',
          type: 'string',
          required: true,
          description: 'Item name',
        },
        {
          name: 'description',
          type: 'string',
          description: 'Item description',
        },
        {
          name: 'status',
          type: 'enum',
          allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'],
          defaultValue: 'ACTIVE',
        },
      ],
      maxRows: 10000,
      maxFileSize: 15 * 1024 * 1024,
      maxColumns: 30,
      validationRules: [
        {
          field: 'sku',
          rule: 'regex',
          param: '^[A-Z0-9_-]+$',
          message: 'SKU must be alphanumeric',
        },
      ],
      transformationRules: [
        { field: 'sku', rule: 'UPPERCASE' },
        { field: 'sku', rule: 'TRIM' },
        { field: 'name', rule: 'TRIM' },
      ],
      identityStrategy: ['sku'],
      supportedModes: [
        DataImportMode.CREATE_ONLY,
        DataImportMode.UPDATE_ONLY,
        DataImportMode.UPSERT,
      ],
      duplicateStrategy: DataDuplicateStrategy.UPDATE,
      modelName: 'item',
    });

    // 8. Finance Invoice Export
    this.register({
      operationKey: 'finance.invoice.export',
      domain: 'finance',
      entity: 'invoice',
      operationType: DataOperationType.EXPORT,
      allowedFormats: ['CSV', 'JSON'],
      requiredPermissions: [
        'accounting.reports.view',
        'data_operations.export.execute',
      ],
      restrictedFieldPermissions: {
        taxAmount: 'data_operations.restricted_fields.export',
      },
      fieldSchema: [
        { name: 'id', type: 'string', description: 'Invoice ID' },
        {
          name: 'invoiceNumber',
          type: 'string',
          required: true,
          description: 'Invoice number',
        },
        {
          name: 'totalAmount',
          type: 'currency_cents',
          description: 'Total in cents',
        },
        {
          name: 'taxAmount',
          type: 'currency_cents',
          isRestricted: true,
          description: 'Tax in cents',
        },
        { name: 'status', type: 'string', description: 'Invoice status' },
      ],
      maxRows: 50000,
      maxFileSize: 25 * 1024 * 1024,
      maxColumns: 40,
      validationRules: [],
      transformationRules: [],
      identityStrategy: ['invoiceNumber'],
      supportedModes: [],
      modelName: 'invoice',
    });
  }
}
