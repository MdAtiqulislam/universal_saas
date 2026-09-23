export interface ProviderCustomerResult {
  providerCustomerId: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderSubscriptionResult {
  providerSubscriptionId: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  metadata?: Record<string, unknown>;
}

export interface ProviderPaymentResult {
  providerTransactionId: string;
  success: boolean;
  status: 'SUCCEEDED' | 'FAILED' | 'PENDING';
  failureReason?: string;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface BillingProviderAdapter {
  readonly providerKey: string;

  createCustomer(
    organizationId: string,
    email: string,
    name: string,
  ): Promise<ProviderCustomerResult>;

  createSubscription(
    organizationId: string,
    providerCustomerId: string,
    priceId: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProviderSubscriptionResult>;

  cancelSubscription(
    providerSubscriptionId: string,
    immediate?: boolean,
  ): Promise<{ success: boolean; cancelledAt: Date }>;

  processPayment(
    organizationId: string,
    amountMinorUnits: number,
    currency: string,
    description: string,
    metadata?: Record<string, unknown>,
  ): Promise<ProviderPaymentResult>;

  verifyWebhookSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean;
}
