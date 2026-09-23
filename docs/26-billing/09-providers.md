# 09. Payment Provider Abstraction & Gateway Integration

## Provider Adapter Architecture

To prevent vendor lock-in, gateway communications route through the `BillingProviderAdapter` interface:

```typescript
export interface BillingProviderAdapter {
  readonly providerKey: string;
  createCustomer(orgId: string, email: string, name: string): Promise<ProviderCustomerResult>;
  createSubscription(
    orgId: string,
    customerId: string,
    priceId: string,
  ): Promise<ProviderSubscriptionResult>;
  cancelSubscription(
    subId: string,
    immediate?: boolean,
  ): Promise<{ success: boolean; cancelledAt: Date }>;
  processPayment(
    orgId: string,
    amount: number,
    currency: string,
    description: string,
  ): Promise<ProviderPaymentResult>;
  verifyWebhookSignature(payload: string | Buffer, signature: string, secret: string): boolean;
}
```

## Built-In Providers

- **`SandboxBillingProviderAdapter`**: High-fidelity sandbox implementation enabling local development, integration testing, and automated invariant verification with zero external network dependencies.
- Extensible to production adapters (Stripe, Paddle, Adyen) by registering new adapter instances with `PaymentProviderService.registerAdapter`.
