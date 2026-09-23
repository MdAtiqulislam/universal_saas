import { Test, TestingModule } from '@nestjs/testing';
import { ChannelRouterService } from '../services/channel-router.service';
import { InAppProviderAdapter } from '../adapters/in-app-provider.adapter';
import { SandboxEmailProviderAdapter } from '../adapters/sandbox-email-provider.adapter';
import { SandboxPushProviderAdapter } from '../adapters/sandbox-push-provider.adapter';
import { SandboxSmsProviderAdapter } from '../adapters/sandbox-sms-provider.adapter';
import { PreferenceRepository } from '../repositories/preference.repository';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';
import { NotificationChannel } from '@prisma/client';
import {
  ChannelProviderAdapter,
  ProviderSendParams,
} from '../adapters/channel-provider.adapter';

describe('ChannelRouterService (Unit)', () => {
  let service: ChannelRouterService;
  let preferenceRepo: { getProviderConfigs: jest.Mock };

  beforeEach(async () => {
    preferenceRepo = {
      getProviderConfigs: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChannelRouterService,
        InAppProviderAdapter,
        SandboxEmailProviderAdapter,
        SandboxPushProviderAdapter,
        SandboxSmsProviderAdapter,
        {
          provide: PreferenceRepository,
          useValue: preferenceRepo,
        },
        {
          provide: StructuredLoggingService,
          useValue: { log: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ChannelRouterService>(ChannelRouterService);
  });

  describe('resolveProvidersForChannel', () => {
    it('should fallback to built-in sandbox adapters when no tenant configs exist', async () => {
      const emailProviders = await service.resolveProvidersForChannel(
        'org-1',
        NotificationChannel.EMAIL,
      );
      expect(emailProviders).toHaveLength(1);
      expect(emailProviders[0].providerKey).toBe('sandbox_email');

      const smsProviders = await service.resolveProvidersForChannel(
        'org-1',
        NotificationChannel.SMS,
      );
      expect(smsProviders).toHaveLength(1);
      expect(smsProviders[0].providerKey).toBe('sandbox_sms');
    });

    it('should sort configured providers by priority ASC (INV-464)', async () => {
      preferenceRepo.getProviderConfigs.mockResolvedValue([
        {
          id: 'c2',
          channel: NotificationChannel.EMAIL,
          providerKey: 'sandbox_email',
          isEnabled: true,
          priority: 2,
        },
        {
          id: 'c1',
          channel: NotificationChannel.EMAIL,
          providerKey: 'in_app_default',
          isEnabled: true,
          priority: 1,
        },
      ]);

      const providers = await service.resolveProvidersForChannel(
        'org-1',
        NotificationChannel.EMAIL,
      );
      expect(providers).toHaveLength(2);
      expect(providers[0].providerKey).toBe('in_app_default');
      expect(providers[1].providerKey).toBe('sandbox_email');
    });
  });

  describe('dispatchWithFailover (INV-464, INV-465)', () => {
    it('should succeed immediately if primary provider succeeds', async () => {
      const params: ProviderSendParams = {
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'alice@example.com',
        content: 'Hello Alice',
      };

      const res = await service.dispatchWithFailover(params);
      expect(res.success).toBe(true);
      expect(res.providerKey).toBe('sandbox_email');
    });

    it('should stop and NOT failover on permanent errors (INV-465)', async () => {
      const primarySend = jest.fn().mockResolvedValue({
        success: false,
        providerKey: 'primary_mock',
        failureCode: 'INVALID_ADDRESS',
        failureCategory: 'PERMANENT',
        error: 'Recipient address does not exist',
        durationMs: 5,
      });

      const secondarySend = jest.fn();

      const mockPrimary: ChannelProviderAdapter = {
        providerKey: 'primary_mock',
        channel: NotificationChannel.EMAIL,
        send: primarySend,
        validateDestination: () => true,
        healthCheck: jest.fn().mockResolvedValue({ status: 'HEALTHY' }),
      };

      const mockSecondary: ChannelProviderAdapter = {
        providerKey: 'secondary_mock',
        channel: NotificationChannel.EMAIL,
        send: secondarySend,
        validateDestination: () => true,
        healthCheck: jest.fn().mockResolvedValue({ status: 'HEALTHY' }),
      };

      service.registerAdapter(mockPrimary);
      service.registerAdapter(mockSecondary);

      preferenceRepo.getProviderConfigs.mockResolvedValue([
        {
          id: '1',
          channel: NotificationChannel.EMAIL,
          providerKey: 'primary_mock',
          isEnabled: true,
          priority: 1,
        },
        {
          id: '2',
          channel: NotificationChannel.EMAIL,
          providerKey: 'secondary_mock',
          isEnabled: true,
          priority: 2,
        },
      ]);

      const params: ProviderSendParams = {
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'bad-email',
        content: 'Hello',
      };

      const result = await service.dispatchWithFailover(params);
      expect(result.success).toBe(false);
      expect(result.failureCategory).toBe('PERMANENT');
      expect(secondarySend).not.toHaveBeenCalled();
    });

    it('should failover to secondary provider on transient errors (INV-464)', async () => {
      const primarySend = jest.fn().mockResolvedValue({
        success: false,
        providerKey: 'primary_mock',
        failureCode: 'RATE_LIMIT_EXCEEDED',
        failureCategory: 'TRANSIENT',
        error: 'HTTP 429 Too Many Requests',
        durationMs: 10,
      });

      const secondarySend = jest.fn().mockResolvedValue({
        success: true,
        providerKey: 'secondary_mock',
        providerMessageId: 'sec_msg_100',
        durationMs: 15,
      });

      const mockPrimary: ChannelProviderAdapter = {
        providerKey: 'primary_mock',
        channel: NotificationChannel.EMAIL,
        send: primarySend,
        validateDestination: () => true,
        healthCheck: jest.fn().mockResolvedValue({ status: 'HEALTHY' }),
      };

      const mockSecondary: ChannelProviderAdapter = {
        providerKey: 'secondary_mock',
        channel: NotificationChannel.EMAIL,
        send: secondarySend,
        validateDestination: () => true,
        healthCheck: jest.fn().mockResolvedValue({ status: 'HEALTHY' }),
      };

      service.registerAdapter(mockPrimary);
      service.registerAdapter(mockSecondary);

      preferenceRepo.getProviderConfigs.mockResolvedValue([
        {
          id: '1',
          channel: NotificationChannel.EMAIL,
          providerKey: 'primary_mock',
          isEnabled: true,
          priority: 1,
        },
        {
          id: '2',
          channel: NotificationChannel.EMAIL,
          providerKey: 'secondary_mock',
          isEnabled: true,
          priority: 2,
        },
      ]);

      const params: ProviderSendParams = {
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'alice@example.com',
        content: 'Hello',
      };

      const result = await service.dispatchWithFailover(params);
      expect(result.success).toBe(true);
      expect(result.providerKey).toBe('secondary_mock');
      expect(primarySend).toHaveBeenCalledTimes(1);
      expect(secondarySend).toHaveBeenCalledTimes(1);
    });
  });
});
