import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
  ProviderSendResult,
  ProviderHealthResult,
} from './channel-provider.adapter';

@Injectable()
export class InAppProviderAdapter implements ChannelProviderAdapter {
  readonly providerKey = 'in_app_default';
  readonly channel = NotificationChannel.IN_APP;

  async send(params: ProviderSendParams): Promise<ProviderSendResult> {
    await Promise.resolve();
    const startTime = Date.now();
    // In-app notifications are stored directly in the database.
    return {
      success: true,
      providerMessageId: `inapp_${params.notificationId}_${params.recipientId}`,
      providerKey: this.providerKey,
      durationMs: Date.now() - startTime,
    };
  }

  validateDestination(destination: string): boolean {
    return !!destination && destination.trim().length > 0;
  }

  async healthCheck(): Promise<ProviderHealthResult> {
    await Promise.resolve();
    return {
      providerKey: this.providerKey,
      channel: this.channel,
      status: 'HEALTHY',
      latencyMs: 1,
      message: 'Internal in-app provider operational',
    };
  }
}
