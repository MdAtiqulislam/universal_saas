import { Test, TestingModule } from '@nestjs/testing';
import { StructuredLoggingService } from '../logging/structured-logging.service';
import { CorrelationContextService } from '../logging/correlation-context.service';
import { RequestLoggingInterceptor } from '../logging/request-logging.interceptor';
import { AuditSanitizerService } from '../../audit/audit-sanitizer.service';
import { of, throwError } from 'rxjs';

describe('M38: Structured Logging & Request Correlation Context', () => {
  let loggingService: StructuredLoggingService;
  let contextService: CorrelationContextService;
  let interceptor: RequestLoggingInterceptor;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StructuredLoggingService,
        CorrelationContextService,
        RequestLoggingInterceptor,
        AuditSanitizerService,
      ],
    }).compile();

    loggingService = module.get<StructuredLoggingService>(
      StructuredLoggingService,
    );
    contextService = module.get<CorrelationContextService>(
      CorrelationContextService,
    );
    interceptor = module.get<RequestLoggingInterceptor>(
      RequestLoggingInterceptor,
    );
  });

  describe('CorrelationContextService (INV-326, INV-327)', () => {
    it('1. should store and retrieve context inside async execution block', () => {
      const mockContext = {
        requestId: 'req-12345',
        correlationId: 'corr-67890',
        organizationId: 'org-abc',
        userId: 'user-xyz',
      };

      contextService.run(mockContext, () => {
        const current = contextService.getContext();
        expect(current).toBeDefined();
        expect(current?.requestId).toBe('req-12345');
        expect(current?.correlationId).toBe('corr-67890');
      });
    });

    it('2. should isolate contexts across concurrent asynchronous executions (INV-327)', async () => {
      const runContext = (id: string, orgId: string) => {
        return new Promise<void>((resolve) => {
          contextService.run(
            { requestId: id, organizationId: orgId },
            async () => {
              await new Promise((r) => setTimeout(r, 10));
              const ctx = contextService.getContext();
              expect(ctx?.requestId).toBe(id);
              expect(ctx?.organizationId).toBe(orgId);
              resolve();
            },
          );
        });
      };

      await Promise.all([
        runContext('req-1', 'org-1'),
        runContext('req-2', 'org-2'),
        runContext('req-3', 'org-3'),
      ]);
    });

    it('3. should return undefined outside of an active execution scope', () => {
      expect(contextService.getContext()).toBeUndefined();
    });

    it('4. should allow mutating tenant/user context dynamically within scope', () => {
      contextService.run({ requestId: 'req-dyn' }, () => {
        contextService.setOrganizationId('org-mutated');
        contextService.setUserId('user-mutated');

        const ctx = contextService.getContext();
        expect(ctx?.organizationId).toBe('org-mutated');
        expect(ctx?.userId).toBe('user-mutated');
      });
    });
  });

  describe('StructuredLoggingService & Sensitive Data Redaction (INV-329)', () => {
    it('5. should redact sensitive keywords from log payloads', () => {
      const logSpy = jest
        .spyOn((loggingService as any).logger, 'log')
        .mockImplementation();

      loggingService.log({
        message: 'User authentication attempt',
        password: 'super_secret_password',
        token: 'jwt.bearer.token',
        apiKey: 'sk-1234567890',
        nonSensitive: 'public_value',
      });

      expect(logSpy).toHaveBeenCalled();
      const rawLog = String(logSpy.mock.calls[0][0]);
      const parsed = JSON.parse(rawLog);

      expect(parsed.password).toMatch(/REDACTED/);
      expect(parsed.token).toMatch(/REDACTED/);
      expect(parsed.apiKey).toMatch(/REDACTED/);
      expect(parsed.nonSensitive).toBe('public_value');
    });

    it('6. should attach correlation context to structured logs automatically', () => {
      const logSpy = jest
        .spyOn((loggingService as any).logger, 'log')
        .mockImplementation();

      contextService.run(
        { requestId: 'req-logged', organizationId: 'org-test' },
        () => {
          loggingService.info('Operation processed', 'TestModule');
        },
      );

      expect(logSpy).toHaveBeenCalled();
      const parsed = JSON.parse(String(logSpy.mock.calls[0][0]));
      expect(parsed.requestId).toBe('req-logged');
      expect(parsed.organizationId).toBe('org-test');
      expect(parsed.module).toBe('TestModule');
    });
  });

  describe('RequestLoggingInterceptor', () => {
    it('7. should assign X-Request-Id header and log completed requests', (done) => {
      const mockRequest: any = {
        headers: {},
        url: '/api/v1/operations/metrics',
        method: 'GET',
      };
      const mockResponse: any = {
        statusCode: 200,
        setHeader: jest.fn(),
      };
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      };
      const mockCallHandler: any = {
        handle: () => of({ success: true }),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        next: (result) => {
          expect(result).toEqual({ success: true });
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-Id',
            expect.any(String),
          );
          done();
        },
      });
    });

    it('8. should log error details on request failure and rethrow', (done) => {
      const mockRequest: any = {
        headers: {},
        url: '/api/v1/operations/fail',
        method: 'POST',
      };
      const mockResponse: any = {
        statusCode: 500,
        setHeader: jest.fn(),
      };
      const mockExecutionContext: any = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      };
      const mockCallHandler: any = {
        handle: () => throwError(() => new Error('Simulated failure')),
      };

      interceptor.intercept(mockExecutionContext, mockCallHandler).subscribe({
        error: (err) => {
          expect(err.message).toBe('Simulated failure');
          expect(mockResponse.setHeader).toHaveBeenCalledWith(
            'X-Request-Id',
            expect.any(String),
          );
          done();
        },
      });
    });
  });
});
