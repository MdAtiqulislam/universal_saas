import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class WebhookSignatureService {
  generateSignature(
    payload: string,
    signingSecret: string,
    timestamp: number,
  ): string {
    const message = `${timestamp}.${payload}`;
    return crypto
      .createHmac('sha256', signingSecret)
      .update(message)
      .digest('hex');
  }

  verifySignature(
    rawPayload: string,
    signature: string,
    signingSecret: string,
    timestamp: number,
    toleranceSeconds = 300,
  ): boolean {
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      return false;
    }
    const expected = this.generateSignature(
      rawPayload,
      signingSecret,
      timestamp,
    );
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expected),
      );
    } catch {
      return false;
    }
  }

  hashApiKey(rawKey: string): string {
    return crypto.createHash('sha256').update(rawKey).digest('hex');
  }

  generateApiKey(): { rawKey: string; hash: string; prefix: string } {
    const rawKey = crypto.randomBytes(32).toString('hex');
    const hash = this.hashApiKey(rawKey);
    const prefix = rawKey.substring(0, 8);
    return { rawKey, hash, prefix };
  }
}
