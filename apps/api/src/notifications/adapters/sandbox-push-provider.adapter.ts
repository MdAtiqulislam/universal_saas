import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
  ProviderSendResult,
  ProviderHealthResult,
} from './channel-provider.adapter';

@Injectable()
export class SandboxPushProviderAdapter implements ChannelProviderAdapter {
  readonly providerKey = 'sandbox_push';
  readonly channel = NotificationChannel.PUSH;

  validateDestination(destination: string): boolean {
    if (!destination) return false;
    // Push token must have non-trivial length
    return destination.trim().length >= 10;
  }

  async send(params: ProviderSendParams): Promise<ProviderSendResult> {
    await Promise.resolve();
    const startTime = Date.now();
    const token = params.destination?.trim() || '';

    if (!this.validateDestination(token)) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'INVALID_PUSH_TOKEN',
        failureCategory: 'PERMANENT',
        error: `Device token missing or malformed: ${token}`,
        durationMs: Date.now() - startTime,
      };
    }

    if (token.startsWith('unregistered_')) {
      return {
        success: false,
        providerKey: this.providerKey,
        failureCode: 'DEVICE_UNREGISTERED',
        failureCategory: 'PERMANENT',
        error: 'Push device token is no longer registered on provider gateway',
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      providerMessageId: `push_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      providerKey: this.providerKey,
      rawResponse: {
        multicast_id: Date.now(),
        success: 1,
        failure: 0,
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
      latencyMs: 12,
      message: 'Sandbox push gateway connected',
    };
  }
}
