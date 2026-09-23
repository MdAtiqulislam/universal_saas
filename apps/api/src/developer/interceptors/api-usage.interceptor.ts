import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiUsageService } from '../services/api-usage.service';
import { ApiKeyContext } from '../guards/api-key-auth.guard';

interface RequestWithTenantAndKey extends Request {
  tenantContext?: { organizationId: string };
  apiKey?: ApiKeyContext;
}

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly usageService: ApiUsageService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<RequestWithTenantAndKey>();
    const res = http.getResponse<Response>();

    const start = Date.now();
    const rawReqId =
      req.headers['x-request-id'] || res.getHeader?.('x-request-id');
    const requestId =
      (Array.isArray(rawReqId) ? rawReqId[0] : (rawReqId as string)) ||
      `req-${Date.now()}`;

    return next.handle().pipe(
      tap(() => {
        try {
          const organizationId =
            req.apiKey?.organizationId || req.tenantContext?.organizationId;

          if (!organizationId) {
            return;
          }

          const durationMs = Date.now() - start;
          const statusCode = res.statusCode || 200;
          const route = req.baseUrl || req.url;
          const rawUserAgent = req.headers['user-agent'];
          const userAgent =
            typeof rawUserAgent === 'string' ? rawUserAgent : null;
          const rawForwarded = req.headers['x-forwarded-for'];
          const clientIp =
            (typeof rawForwarded === 'string'
              ? rawForwarded.split(',')[0].trim()
              : Array.isArray(rawForwarded)
                ? rawForwarded[0]
                : req.socket?.remoteAddress) ?? null;

          void this.usageService.recordUsage({
            organizationId,
            apiKeyId: req.apiKey?.id ?? null,
            requestId,
            method: req.method,
            route,
            statusCode,
            durationMs,
            userAgent,
            clientIp,
            apiVersion: 'v1',
          });
        } catch {
          // Usage logging failure must never affect HTTP response
        }
      }),
    );
  }
}
