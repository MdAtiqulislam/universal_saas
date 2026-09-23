import { BadRequestException } from '@nestjs/common';
import { FilterAstEngineService } from '../services/filter-ast-engine.service';
import {
  FilterNode,
  FilterOperator,
  LogicalOperator,
} from '../dto/filter-ast.dto';

describe('FilterAstEngineService', () => {
  let service: FilterAstEngineService;

  beforeEach(() => {
    service = new FilterAstEngineService();
  });

  describe('validateAst', () => {
    it('validates simple field condition with allowed fields', () => {
      const node: FilterNode = {
        field: 'status',
        operator: FilterOperator.EQUALS,
        value: 'ACTIVE',
      };

      const result = service.validateAst(node, [
        { field: 'status', type: 'STRING' },
      ]);
      expect(result.nodeCount).toBe(1);
      expect(result.maxDepth).toBe(1);
    });

    it('rejects field not in allowed list (INV-480)', () => {
      const node: FilterNode = {
        field: 'forbiddenField',
        operator: FilterOperator.EQUALS,
        value: 'test',
      };

      expect(() =>
        service.validateAst(node, [{ field: 'status', type: 'STRING' }]),
      ).toThrow(BadRequestException);
    });

    it('rejects incompatible operator for field type (INV-481)', () => {
      const node: FilterNode = {
        field: 'isActive',
        operator: FilterOperator.CONTAINS,
        value: 'true',
      };

      expect(() =>
        service.validateAst(node, [{ field: 'isActive', type: 'BOOLEAN' }]),
      ).toThrow(BadRequestException);
    });

    it('enforces maximum depth limit of 5 (INV-482)', () => {
      // Build a tree of depth 6
      let current: FilterNode = {
        field: 'status',
        operator: FilterOperator.EQUALS,
        value: 'A',
      };
      for (let i = 0; i < 5; i++) {
        current = {
          logicalOperator: LogicalOperator.AND,
          conditions: [current],
        };
      }

      expect(() =>
        service.validateAst(current, [{ field: 'status', type: 'STRING' }]),
      ).toThrow(BadRequestException);
    });

    it('enforces maximum node count limit of 20 (INV-482)', () => {
      const conditions: FilterNode[] = Array.from({ length: 21 }, (_, i) => ({
        field: 'status',
        operator: FilterOperator.EQUALS,
        value: `val_${i}`,
      }));

      const group: FilterNode = {
        logicalOperator: LogicalOperator.OR,
        conditions,
      };

      expect(() =>
        service.validateAst(group, [{ field: 'status', type: 'STRING' }]),
      ).toThrow(BadRequestException);
    });

    it('enforces string length bound of 256 (INV-483)', () => {
      const longString = 'x'.repeat(257);
      const node: FilterNode = {
        field: 'description',
        operator: FilterOperator.CONTAINS,
        value: longString,
      };

      expect(() =>
        service.validateAst(node, [{ field: 'description', type: 'STRING' }]),
      ).toThrow(BadRequestException);
    });

    it('enforces array item bound of 50 (INV-483)', () => {
      const longArray = Array.from({ length: 51 }, (_, i) => `item_${i}`);
      const node: FilterNode = {
        field: 'status',
        operator: FilterOperator.IN,
        value: longArray,
      };

      expect(() =>
        service.validateAst(node, [{ field: 'status', type: 'STRING' }]),
      ).toThrow(BadRequestException);
    });
  });

  describe('evaluate', () => {
    const sampleRecord = {
      id: 'rec-1',
      status: 'ACTIVE',
      amount: 150,
      tags: ['alpha', 'beta'],
      archived: false,
    };

    it('evaluates string equals and contains', () => {
      expect(
        service.evaluate(sampleRecord, {
          field: 'status',
          operator: FilterOperator.EQUALS,
          value: 'active',
        }),
      ).toBe(true);

      expect(
        service.evaluate(sampleRecord, {
          field: 'status',
          operator: FilterOperator.CONTAINS,
          value: 'act',
        }),
      ).toBe(true);

      expect(
        service.evaluate(sampleRecord, {
          field: 'status',
          operator: FilterOperator.EQUALS,
          value: 'INACTIVE',
        }),
      ).toBe(false);
    });

    it('evaluates numeric comparisons (gt, gte, lt, lte, between)', () => {
      expect(
        service.evaluate(sampleRecord, {
          field: 'amount',
          operator: FilterOperator.GREATER_THAN,
          value: 100,
        }),
      ).toBe(true);

      expect(
        service.evaluate(sampleRecord, {
          field: 'amount',
          operator: FilterOperator.BETWEEN,
          value: 100,
          secondaryValue: 200,
        }),
      ).toBe(true);

      expect(
        service.evaluate(sampleRecord, {
          field: 'amount',
          operator: FilterOperator.LESS_THAN,
          value: 100,
        }),
      ).toBe(false);
    });

    it('evaluates logical AND, OR, and NOT groups correctly', () => {
      const andGroup: FilterNode = {
        logicalOperator: LogicalOperator.AND,
        conditions: [
          { field: 'status', operator: FilterOperator.EQUALS, value: 'ACTIVE' },
          { field: 'amount', operator: FilterOperator.GREATER_THAN, value: 50 },
        ],
      };
      expect(service.evaluate(sampleRecord, andGroup)).toBe(true);

      const orGroup: FilterNode = {
        logicalOperator: LogicalOperator.OR,
        conditions: [
          {
            field: 'status',
            operator: FilterOperator.EQUALS,
            value: 'DELETED',
          },
          { field: 'amount', operator: FilterOperator.GREATER_THAN, value: 50 },
        ],
      };
      expect(service.evaluate(sampleRecord, orGroup)).toBe(true);

      const notGroup: FilterNode = {
        logicalOperator: LogicalOperator.NOT,
        conditions: [
          { field: 'status', operator: FilterOperator.EQUALS, value: 'ACTIVE' },
        ],
      };
      expect(service.evaluate(sampleRecord, notGroup)).toBe(false);
    });
  });
});
