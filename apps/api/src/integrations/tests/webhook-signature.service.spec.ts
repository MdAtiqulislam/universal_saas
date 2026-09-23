import { WebhookSignatureService } from '../webhooks/webhook-signature.service';

describe('WebhookSignatureService', () => {
  let service: WebhookSignatureService;

  beforeEach(() => {
    service = new WebhookSignatureService();
  });

  it('should generate deterministic HMAC-SHA256 signature', () => {
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const secret = 'whsec_test_secret_key';
    const timestamp = 1700000000;

    const sig1 = service.generateSignature(payload, secret, timestamp);
    const sig2 = service.generateSignature(payload, secret, timestamp);

    expect(sig1).toHaveLength(64);
    expect(sig1).toBe(sig2);
  });

  it('should verify a valid signature within time tolerance', () => {
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const secret = 'whsec_test_secret_key';
    const now = Math.floor(Date.now() / 1000);

    const signature = service.generateSignature(payload, secret, now);
    const isValid = service.verifySignature(
      payload,
      signature,
      secret,
      now,
      300,
    );

    expect(isValid).toBe(true);
  });

  it('should reject signature when payload has been modified', () => {
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const tampered = JSON.stringify({ event: 'order.created', id: '124' });
    const secret = 'whsec_test_secret_key';
    const now = Math.floor(Date.now() / 1000);

    const signature = service.generateSignature(payload, secret, now);
    const isValid = service.verifySignature(
      tampered,
      signature,
      secret,
      now,
      300,
    );

    expect(isValid).toBe(false);
  });

  it('should reject signature when timestamp exceeds tolerance window (replay attack)', () => {
    const payload = JSON.stringify({ event: 'order.created', id: '123' });
    const secret = 'whsec_test_secret_key';
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago

    const signature = service.generateSignature(payload, secret, oldTimestamp);
    const isValid = service.verifySignature(
      payload,
      signature,
      secret,
      oldTimestamp,
      300,
    );

    expect(isValid).toBe(false);
  });

  it('should generate secure API keys with 8-character prefix and 64-character hash', () => {
    const keyData = service.generateApiKey();

    expect(keyData.rawKey).toHaveLength(64);
    expect(keyData.prefix).toHaveLength(8);
    expect(keyData.hash).toHaveLength(64);
    expect(keyData.rawKey.startsWith(keyData.prefix)).toBe(true);
    expect(service.hashApiKey(keyData.rawKey)).toBe(keyData.hash);
  });
});
