import { Injectable, BadRequestException } from '@nestjs/common';
import { BillingProviderAdapter } from '../adapters/billing-provider.adapter';
import { SandboxBillingProviderAdapter } from '../adapters/sandbox-billing-provider.adapter';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class PaymentProviderService {
  private readonly adapters: Map<string, BillingProviderAdapter> = new Map();

  constructor(
    private readonly sandboxAdapter: SandboxBillingProviderAdapter,
    private readonly logger: StructuredLoggingService,
  ) {
    this.registerAdapter(this.sandboxAdapter);
  }

  registerAdapter(adapter: BillingProviderAdapter) {
    this.adapters.set(adapter.providerKey.toLowerCase(), adapter);
    this.logger.log({
      level: 'INFO',
      message: `Registered billing provider adapter: ${adapter.providerKey}`,
      providerKey: adapter.providerKey,
    });
  }

  getAdapter(providerKey: string = 'sandbox'): BillingProviderAdapter {
    const key = (providerKey || 'sandbox').toLowerCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new BadRequestException(
        `Unsupported billing payment provider: '${providerKey}'`,
      );
    }
    return adapter;
  }

  async createCustomer(
    organizationId: string,
    email: string,
    name: string,
    providerKey: string = 'sandbox',
  ) {
    const adapter = this.getAdapter(providerKey);
    return adapter.createCustomer(organizationId, email, name);
  }

  async createSubscription(
    organizationId: string,
    providerCustomerId: string,
    priceId: string,
    providerKey: string = 'sandbox',
    metadata?: Record<string, unknown>,
  ) {
    const adapter = this.getAdapter(providerKey);
    return adapter.createSubscription(
      organizationId,
      providerCustomerId,
      priceId,
      metadata,
    );
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    providerKey: string = 'sandbox',
    immediate: boolean = false,
  ) {
    const adapter = this.getAdapter(providerKey);
    return adapter.cancelSubscription(providerSubscriptionId, immediate);
  }

  async processPayment(
    organizationId: string,
    amountMinorUnits: number,
    currency: string,
    description: string,
    providerKey: string = 'sandbox',
    metadata?: Record<string, unknown>,
  ) {
    const adapter = this.getAdapter(providerKey);
    return adapter.processPayment(
      organizationId,
      amountMinorUnits,
      currency,
      description,
      metadata,
    );
  }

  verifyWebhookSignature(
    providerKey: string,
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const adapter = this.getAdapter(providerKey);
    return adapter.verifyWebhookSignature(payload, signature, secret);
  }

  listProviders(): string[] {
    return Array.from(this.adapters.keys());
  }
}
