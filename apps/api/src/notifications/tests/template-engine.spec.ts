import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TemplateEngineService } from '../services/template-engine.service';
import { TemplateManagementService } from '../services/template-management.service';
import { TemplateRepository } from '../repositories/template.repository';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

describe('TemplateEngineService (Unit)', () => {
  let engine: TemplateEngineService;
  let management: TemplateManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateEngineService,
        TemplateManagementService,
        {
          provide: TemplateRepository,
          useValue: {},
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    engine = module.get<TemplateEngineService>(TemplateEngineService);
    management = module.get<TemplateManagementService>(
      TemplateManagementService,
    );
  });

  describe('render', () => {
    it('should render simple variables in subject and body', () => {
      const result = engine.render(
        'Hello, {{name}}! Welcome to {{app}}.',
        { name: 'Alice', app: 'Universal SaaS' },
        'Welcome {{name}}',
      );

      expect(result.renderedSubject).toBe('Welcome Alice');
      expect(result.renderedBody).toBe(
        'Hello, Alice! Welcome to Universal SaaS.',
      );
    });

    it('should resolve nested dot-path variables', () => {
      const result = engine.render(
        'Invoice #{{invoice.number}} is {{invoice.status}}. Total: {{invoice.amount.currency}}{{invoice.amount.value}}.',
        {
          invoice: {
            number: 'INV-2026-001',
            status: 'PAID',
            amount: {
              currency: '$',
              value: 120,
            },
          },
        },
      );

      expect(result.renderedBody).toBe(
        'Invoice #INV-2026-001 is PAID. Total: $120.',
      );
    });

    it('should coalesce undefined or null variables to empty string without throwing', () => {
      const result = engine.render(
        'Hello {{missing.user.name}}, your code is {{code}}.',
        { code: '123456' },
      );

      expect(result.renderedBody).toBe('Hello , your code is 123456.');
    });

    it('should stringify objects instead of crashing or outputting undefined', () => {
      const result = engine.render('Details: {{metadata}}', {
        metadata: { env: 'prod', region: 'us-east' },
      });

      expect(result.renderedBody).toContain(
        '{"env":"prod","region":"us-east"}',
      );
    });

    it('should throw BadRequestException if rendered output exceeds max limit', () => {
      const hugeString = 'a'.repeat(300000);
      expect(() => {
        engine.render('{{data}}', { data: hugeString });
      }).toThrow(BadRequestException);
    });

    it('should throw BadRequestException on code execution attempts (INV-457)', () => {
      const malicious = 'Hello {{eval(1+1)}}';
      expect(() => {
        engine.render(malicious, {});
      }).toThrow(BadRequestException);
    });
  });

  describe('computeSnapshotHash (INV-459)', () => {
    it('should produce deterministic SHA-256 hash', () => {
      const hash1 = management.computeSnapshotHash('Subject', 'Body content', [
        'name',
        'email',
      ]);
      const hash2 = management.computeSnapshotHash('Subject', 'Body content', [
        'email',
        'name',
      ]);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should produce different hash when content changes', () => {
      const hash1 = management.computeSnapshotHash('Subject', 'Body 1', [
        'name',
      ]);
      const hash2 = management.computeSnapshotHash('Subject', 'Body 2', [
        'name',
      ]);

      expect(hash1).not.toBe(hash2);
    });
  });
});
