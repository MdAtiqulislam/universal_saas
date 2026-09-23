import { Injectable, Logger, Scope } from '@nestjs/common';
import { AuditSanitizerService } from '../../audit/audit-sanitizer.service';
import { CorrelationContextService } from './correlation-context.service';

export interface LogFields {
  message: string;
  module?: string;
  level?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';
  event?: string;
  errorCode?: string;
  durationMs?: number;
  statusCode?: number;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.DEFAULT })
export class StructuredLoggingService {
  private readonly logger = new Logger('StructuredLogging');
  private readonly restrictedKeys = new Set([
    'password',
    'accesstoken',
    'refreshtoken',
    'authorization',
    'cookie',
    'secret',
    'clientsecret',
    'apikey',
    'token',
  ]);

  constructor(
    private readonly auditSanitizer: AuditSanitizerService,
    private readonly correlationContext: CorrelationContextService,
  ) {}

  private redact(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.redact(item));

    const redacted: Record<string, unknown> = {
      ...(obj as Record<string, unknown>),
    };
    for (const key of Object.keys(redacted)) {
      if (
        this.restrictedKeys.has(key.toLowerCase()) ||
        this.restrictedKeys.has(key)
      ) {
        redacted[key] = '***REDACTED***';
      } else if (typeof redacted[key] === 'object' && redacted[key] !== null) {
        redacted[key] = this.redact(redacted[key]);
      }
    }
    return redacted;
  }

  log(fields: LogFields): void {
    const context = this.correlationContext.getContext();
    const payload = {
      timestamp: new Date().toISOString(),
      level: fields.level || 'INFO',
      service: 'api',
      module: fields.module || 'System',
      environment: process.env.NODE_ENV || 'development',
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      organizationId: context?.organizationId,
      userId: context?.userId,
      route: context?.route,
      method: context?.method,
      statusCode: fields.statusCode,
      durationMs: fields.durationMs,
      event: fields.event,
      errorCode: fields.errorCode,
      ...(this.auditSanitizer.sanitize(this.redact(fields)) as Record<
        string,
        unknown
      >),
    };

    const message = JSON.stringify(payload);

    switch (payload.level) {
      case 'TRACE':
      case 'DEBUG':
        this.logger.debug(message);
        break;
      case 'WARN':
        this.logger.warn(message);
        break;
      case 'ERROR':
      case 'FATAL':
        this.logger.error(message);
        break;
      case 'INFO':
      default:
        this.logger.log(message);
        break;
    }
  }

  error(message: string, trace?: string, module?: string): void {
    this.log({ message, level: 'ERROR', module, trace });
  }

  warn(message: string, module?: string): void {
    this.log({ message, level: 'WARN', module });
  }

  info(message: string, module?: string): void {
    this.log({ message, level: 'INFO', module });
  }
}
