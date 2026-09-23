import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import * as crypto from 'crypto';
import { Request, Response } from 'express';
import { CorrelationContextService } from './correlation-context.service';
import { StructuredLoggingService } from './structured-logging.service';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly SLOW_REQUEST_THRESHOLD_MS = process.env
    .SLOW_REQUEST_THRESHOLD_MS
    ? parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10)
    : 1000;

  constructor(
    private readonly correlationContext: CorrelationContextService,
    private readonly logger: StructuredLoggingService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const requestId = crypto.randomUUID();
    const headerCorr = req.headers['x-correlation-id'];
    const correlationId =
      (Array.isArray(headerCorr) ? headerCorr[0] : headerCorr) || requestId;

    if (res && typeof res.setHeader === 'function') {
      res.setHeader('X-Request-Id', requestId);
    }

    const route = req.baseUrl || req.url;
    const method = req.method;

    const ctx = {
      requestId,
      correlationId,
      route,
      method,
    };

    return this.correlationContext.run(ctx, () => {
      const start = Date.now();
      return next.handle().pipe(
        tap(() => {
          try {
            const durationMs = Date.now() - start;
            const statusCode = res.statusCode || 200;

            this.logger.log({
              message: 'Request completed',
              level: 'INFO',
              route,
              method,
              statusCode,
              durationMs,
              event: 'http_request_completed',
            });

            if (durationMs > this.SLOW_REQUEST_THRESHOLD_MS) {
              this.logger.warn(
                `Slow request detected: ${durationMs}ms`,
                'RequestLoggingInterceptor',
              );
            }
          } catch {
            // Never crash pipeline
          }
        }),
        catchError((err: unknown) => {
          try {
            const durationMs = Date.now() - start;
            const errObj =
              typeof err === 'object' && err !== null
                ? (err as Record<string, unknown>)
                : null;
            const status =
              typeof errObj?.status === 'number' ? errObj.status : 500;
            const errMsg = err instanceof Error ? err.message : 'Unknown error';
            const errCode =
              typeof errObj?.code === 'string'
                ? errObj.code
                : err instanceof Error
                  ? err.name
                  : 'UNKNOWN_ERROR';

            this.logger.log({
              message: `Request failed: ${errMsg}`,
              level: 'ERROR',
              route,
              method,
              statusCode: status,
              durationMs,
              event: 'http_request_failed',
              errorCode: errCode,
            });
          } catch {
            // Ignore
          }
          throw err;
        }),
      );
    });
  }
}
