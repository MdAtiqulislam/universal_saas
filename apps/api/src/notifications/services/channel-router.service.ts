import { Injectable } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
  ProviderSendResult,
} from '../adapters/channel-provider.adapter';
import { InAppProviderAdapter } from '../adapters/in-app-provider.adapter';
import { SandboxEmailProviderAdapter } from '../adapters/sandbox-email-provider.adapter';
import { SandboxPushProviderAdapter } from '../adapters/sandbox-push-provider.adapter';
import { SandboxSmsProviderAdapter } from '../adapters/sandbox-sms-provider.adapter';
import { PreferenceRepository } from '../repositories/preference.repository';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class ChannelRouterService {
  private readonly providerAdapters: Map<string, ChannelProviderAdapter> =
    new Map();

  constructor(
    private readonly inAppAdapter: InAppProviderAdapter,
    private readonly emailAdapter: SandboxEmailProviderAdapter,
    private readonly pushAdapter: SandboxPushProviderAdapter,
    private readonly smsAdapter: SandboxSmsProviderAdapter,
    private readonly preferenceRepo: PreferenceRepository,
    private readonly logger: StructuredLoggingService,
  ) {
    this.registerAdapter(this.inAppAdapter);
    this.registerAdapter(this.emailAdapter);
    this.registerAdapter(this.pushAdapter);
    this.registerAdapter(this.smsAdapter);
  }

  registerAdapter(adapter: ChannelProviderAdapter): void {
    this.providerAdapters.set(adapter.providerKey, adapter);
  }

  getAdapter(providerKey: string): ChannelProviderAdapter | undefined {
    return this.providerAdapters.get(providerKey);
  }

  /**
   * Resolves list of configured providers for a channel in priority order (primary first, then fallback)
   */
  async resolveProvidersForChannel(
    organizationId: string,
    channel: NotificationChannel,
  ): Promise<ChannelProviderAdapter[]> {
    const configs =
      await this.preferenceRepo.getProviderConfigs(organizationId);
    const channelConfigs = configs
      .filter((c) => c.channel === channel && c.isEnabled)
      .sort((a, b) => a.priority - b.priority);

    const adapters: ChannelProviderAdapter[] = [];

    for (const conf of channelConfigs) {
      const adapter = this.getAdapter(conf.providerKey);
      if (adapter) {
        adapters.push(adapter);
      }
    }

    // Default fallback to built-in sandbox adapters if no tenant-specific configs exist
    if (adapters.length === 0) {
      switch (channel) {
        case NotificationChannel.IN_APP:
          adapters.push(this.inAppAdapter);
          break;
        case NotificationChannel.EMAIL:
          adapters.push(this.emailAdapter);
          break;
        case NotificationChannel.PUSH:
          adapters.push(this.pushAdapter);
          break;
        case NotificationChannel.SMS:
          adapters.push(this.smsAdapter);
          break;
      }
    }

    return adapters;
  }

  /**
   * Dispatches message with automatic provider failover on transient errors
   */
  async dispatchWithFailover(
    params: ProviderSendParams,
  ): Promise<ProviderSendResult> {
    const providers = await this.resolveProvidersForChannel(
      params.organizationId,
      params.channel,
    );

    let lastResult: ProviderSendResult = {
      success: false,
      providerKey: 'none',
      error: `No active provider found for channel ${params.channel}`,
      durationMs: 0,
    };

    for (let i = 0; i < providers.length; i++) {
      const provider = providers[i];
      const result = await provider.send(params);

      if (result.success) {
        return result;
      }

      lastResult = result;

      // Failover only on TRANSIENT or PROVIDER errors.
      // Do NOT failover on PERMANENT errors (e.g. malformed email address).
      if (
        result.failureCategory !== 'TRANSIENT' &&
        result.failureCategory !== 'PROVIDER'
      ) {
        break;
      }

      this.logger.log({
        level: 'WARN',
        message: `Provider ${provider.providerKey} failed (${result.failureCode}). Attempting failover to next provider...`,
        organizationId: params.organizationId,
        channel: params.channel,
        failureCode: result.failureCode,
      });
    }

    return lastResult;
  }
}
