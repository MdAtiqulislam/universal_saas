import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
  ProviderSendResult,
  ProviderHealthResult,
} from './channel-provider.adapter';

@Injectable()
export class SandboxSmsProviderAdapter implements ChannelProviderAdapter {
  readonly providerKey = 'sandbox_sms';
  readonly channel = NotificationChannel.SMS;

  // Standard E.164 international phone number format: + followed by 7 to 15 digits
  private readonly phoneRegex = /^\+[1-9]\d{6,14}$/;

  validateDestination(destination: string): boolean {
    if (!destination) return false;
    return this.phoneRegex.test(destination.trim());
  }

  async send(params: ProviderSendParams): Promise<ProviderSendResult> {
    await Promise.resolve();
    const startTime = Date.now();
    const phone = params.destination?.trim() || '';

    if (!this.validateDestination(phone)) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'INVALID_PHONE_NUMBER',
        failureCategory: 'PERMANENT',
        error: `Invalid E.164 phone number format: ${phone}. Expected format: +[country][number] (e.g. +14155552671)`,
        durationMs: Date.now() - startTime,
      };
    }

    if (phone.endsWith('0000')) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'CARRIER_UNREACHABLE',
        failureCategory: 'TRANSIENT',
        error: 'Carrier route congestion, temporary failure',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      providerMessageId: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      providerKey: this.providerKey,
      rawResponse: {
        sid: `SM${Math.random().toString(36).substring(2, 12)}`,
        status: 'sent',
      },
      durationMs: Date.now() - startTime,
    };
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    await Promise.resolve();
    return {
      providerKey: this.providerKey,
      channel: this.channel,
      status: 'HEALTHY',
      latencyMs: 8,
      message: 'Sandbox SMS gateway operational',
    };
  }
}
