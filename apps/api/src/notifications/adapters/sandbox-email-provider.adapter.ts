import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
  ProviderSendResult,
  ProviderHealthResult,
} from './channel-provider.adapter';

@Injectable()
export class SandboxEmailProviderAdapter implements ChannelProviderAdapter {
  readonly providerKey = 'sandbox_email';
  readonly channel = NotificationChannel.EMAIL;

  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  validateDestination(destination: string): boolean {
    if (!destination) return false;
    return this.emailRegex.test(destination.trim());
  }

  async send(params: ProviderSendParams): Promise<ProviderSendResult> {
    await Promise.resolve();
    const startTime = Date.now();
    const destination = params.destination?.trim() || '';

    if (!this.validateDestination(destination)) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'INVALID_EMAIL_ADDRESS',
        failureCategory: 'PERMANENT',
        error: `Malformed or invalid email address: ${destination}`,
        durationMs: Date.now() - startTime,
      };
    }

    // Simulated test cases for bounce or outage
    if (destination.includes('bounce@')) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'EMAIL_BOUNCED',
        failureCategory: 'PERMANENT',
        error: 'Recipient mailbox unavailable or rejected by destination MX',
        durationMs: Date.now() - startTime,
      };
    }

    if (destination.includes('fail@')) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'SERVICE_UNAVAILABLE',
        failureCategory: 'TRANSIENT',
        error: 'SMTP gateway timeout, retry permitted',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      providerMessageId: `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      providerKey: this.providerKey,
      rawResponse: {
        accepted: [destination],
        status: 'queued_in_sandbox',
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
      latencyMs: 5,
      message: 'Sandbox email provider active and accepting traffic',
    };
  }
}
