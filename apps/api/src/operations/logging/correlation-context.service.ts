import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface CorrelationContext {
  requestId: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  organizationId?: string;
  userId?: string;
  route?: string;
  method?: string;
}

@Injectable()
export class CorrelationContextService {
  private readonly als = new AsyncLocalStorage<CorrelationContext>();

  run<T>(context: CorrelationContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  getContext(): CorrelationContext | undefined {
    return this.als.getStore();
  }

  setOrganizationId(id: string): void {
    const context = this.getContext();
    if (context) {
      context.organizationId = id;
    }
  }

  setUserId(id: string): void {
    const context = this.getContext();
    if (context) {
      context.userId = id;
    }
  }
}
