import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { OperationalErrorsService } from './operational-errors.service';
import { StructuredLoggingService } from '../logging/structured-logging.service';
import { CorrelationContextService } from '../logging/correlation-context.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly errorsService: OperationalErrorsService,
    private readonly logger: StructuredLoggingService,
    private readonly contextService: CorrelationContextService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationCtx = this.contextService.getContext();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errorCode = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const obj = res as Record<string, unknown>;
        message =
          typeof obj.message === 'string'
            ? obj.message
            : Array.isArray(obj.message)
              ? obj.message.join(', ')
              : exception.message;
        errorCode =
          typeof obj.error === 'string' ? obj.error : 'HTTP_EXCEPTION';
      } else {
        message = String(res);
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      errorCode = exception.name;
    }

    const err =
      exception instanceof Error ? exception : new Error(String(exception));
    const classification = this.errorsService.classify(err, 'GlobalFilter');

    // Async record, non-blocking
    void this.errorsService.record({
      module: 'GlobalFilter',
      message: err.message,
      category: classification.category,
      severity: classification.severity,
      errorCode,
      stackTrace:
        process.env.NODE_ENV !== 'development' ? undefined : err.stack,
      organizationId: correlationCtx?.organizationId,
    });

    this.logger.error(err.message, err.stack, 'GlobalFilter');

    const statusCodeNum: number = Number(status);
    const errorResponse = {
      statusCode: statusCodeNum,
      message: statusCodeNum >= 500 ? 'Internal server error' : message,
      errorCode,
      requestId: correlationCtx?.requestId || request.headers['x-request-id'],
      correlationId: correlationCtx?.correlationId,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCodeNum).json(errorResponse);
  }
}
