import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import {
  BillingProviderAdapter,
  ProviderCustomerResult,
  ProviderSubscriptionResult,
  ProviderPaymentResult,
} from './billing-provider.adapter';

@Injectable()
export class SandboxBillingProviderAdapter implements BillingProviderAdapter {
  readonly providerKey = 'sandbox';

  async createCustomer(
    organizationId: string,
    email: string,
    name: string,
  ): Promise<ProviderCustomerResult> {
    await Promise.resolve();
    const providerCustomerId = `cus_sb_${organizationId.substring(0, 8)}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      providerCustomerId,
      metadata: { email, name, provider: 'sandbox' },
    };
  }

  async createSubscription(
    organizationId: string,
    providerCustomerId: string,
    priceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProviderSubscriptionResult> {
    await Promise.resolve();
    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const providerSubscriptionId = `sub_sb_${crypto.randomBytes(8).toString('hex')}`;

    return {
      providerSubscriptionId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      metadata: { ...metadata, providerCustomerId, priceId },
    };
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    immediate?: boolean,
  ): Promise<{ success: boolean; cancelledAt: Date }> {
    await Promise.resolve({ providerSubscriptionId, immediate });
    return {
      success: true,
      cancelledAt: new Date(),
    };
  }

  async processPayment(
    organizationId: string,
    amountMinorUnits: number,
    currency: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProviderPaymentResult> {
    await Promise.resolve();
    // Sandbox auto-approves all transactions except if amount equals 99999999 (test trigger for failure)
    const isTestFailure = amountMinorUnits === 99999999;
    const providerTransactionId = `txn_sb_${crypto.randomBytes(8).toString('hex')}`;

    if (isTestFailure) {
      return {
        providerTransactionId,
        success: false,
        status: 'FAILED',
        failureReason: 'Sandbox simulated card decline',
        metadata,
      };
    }

    return {
      providerTransactionId,
      success: true,
      status: 'SUCCEEDED',
      paidAt: new Date(),
      metadata: { ...metadata, currency, description },
    };
  }

  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    if (!signature || !secret) return false;
    const computed = crypto
      .createHmac('sha256', secret)
      .update(typeof payload === 'string' ? payload : payload.toString('utf-8'))
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(computed, 'hex'),
    );
  }
}
