import { RulesEngineService } from '../rules/rules-engine.service';
import { RuleValidatorService } from '../rules/rule-validator.service';
import { BadRequestException } from '@nestjs/common';

describe('RulesEngineService & RuleValidatorService (M40)', () => {
  let rulesEngine: RulesEngineService;
  let ruleValidator: RuleValidatorService;

  beforeEach(() => {
    ruleValidator = new RuleValidatorService();
    rulesEngine = new RulesEngineService(ruleValidator);
  });

  describe('Declarative AST Operator Evaluations', () => {
    it('evaluates comparison operators (EQUALS, GREATER_THAN, LESS_THAN)', () => {
      const context = { event: { amount: 1500, status: 'CONFIRMED' } };

      const gtRule = {
        operator: 'GREATER_THAN',
        left: { path: 'event.amount' },
        right: { value: 1000 },
      };
      expect(rulesEngine.evaluate(gtRule, context).result).toBe(true);

      const eqRule = {
        operator: 'EQUALS',
        left: { path: 'event.status' },
        right: { value: 'CONFIRMED' },
      };
      expect(rulesEngine.evaluate(eqRule, context).result).toBe(true);

      const ltRule = {
        operator: 'LESS_THAN',
        left: { path: 'event.amount' },
        right: { value: 500 },
      };
      expect(rulesEngine.evaluate(ltRule, context).result).toBe(false);
    });

    it('evaluates boolean composition operators (AND, OR, NOT)', () => {
      const context = {
        user: { role: 'MANAGER', department: 'FINANCE', active: true },
      };

      const andRule = {
        operator: 'AND',
        operands: [
          {
            operator: 'EQUALS',
            left: { path: 'user.role' },
            right: { value: 'MANAGER' },
          },
          {
            operator: 'EQUALS',
            left: { path: 'user.department' },
            right: { value: 'FINANCE' },
          },
        ],
      };
      expect(rulesEngine.evaluate(andRule, context).result).toBe(true);

      const orRule = {
        operator: 'OR',
        operands: [
          {
            operator: 'EQUALS',
            left: { path: 'user.role' },
            right: { value: 'ADMIN' },
          },
          {
            operator: 'EQUALS',
            left: { path: 'user.department' },
            right: { value: 'FINANCE' },
          },
        ],
      };
      expect(rulesEngine.evaluate(orRule, context).result).toBe(true);

      const notRule = {
        operator: 'NOT',
        operands: [
          {
            operator: 'EQUALS',
            left: { path: 'user.active' },
            right: { value: false },
          },
        ],
      };
      expect(rulesEngine.evaluate(notRule, context).result).toBe(true);
    });

    it('evaluates collection and string operators (IN, CONTAINS, STARTS_WITH)', () => {
      const context = {
        event: { sku: 'SKU-ELECTRONICS-99', category: 'vip' },
      };

      const inRule = {
        operator: 'IN',
        left: { path: 'event.category' },
        right: { value: ['vip', 'urgent'] },
      };
      expect(rulesEngine.evaluate(inRule, context).result).toBe(true);

      const startsWithRule = {
        operator: 'STARTS_WITH',
        left: { path: 'event.sku' },
        right: { value: 'SKU-' },
      };
      expect(rulesEngine.evaluate(startsWithRule, context).result).toBe(true);
    });
  });

  describe('AST Safety & Guardrails (INV-390, INV-391)', () => {
    it('rejects AST exceeding maximum allowed depth of 10', () => {
      let nested: any = {
        operator: 'EQUALS',
        left: { path: 'event.val' },
        right: { value: 1 },
      };
      for (let i = 0; i < 12; i++) {
        nested = { operator: 'AND', operands: [nested] };
      }

      expect(() => ruleValidator.validate(nested)).toThrow(BadRequestException);
    });

    it('rejects unsupported or arbitrary code execution operators', () => {
      const maliciousAst = {
        operator: 'EXEC_CODE',
        code: 'process.exit(1)',
      };

      expect(() => ruleValidator.validate(maliciousAst)).toThrow(
        BadRequestException,
      );
    });

    it('blocks prototype pollution attempts on field paths', () => {
      const pollutionAst = {
        operator: 'EQUALS',
        left: { path: 'event.__proto__.polluted' },
        right: { value: true },
      };

      expect(() => ruleValidator.validate(pollutionAst)).toThrow(
        BadRequestException,
      );
    });
  });
});
