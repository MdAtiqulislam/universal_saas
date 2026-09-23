import { InAppProviderAdapter } from '../adapters/in-app-provider.adapter';
import { SandboxEmailProviderAdapter } from '../adapters/sandbox-email-provider.adapter';
import { SandboxPushProviderAdapter } from '../adapters/sandbox-push-provider.adapter';
import { SandboxSmsProviderAdapter } from '../adapters/sandbox-sms-provider.adapter';
import { NotificationChannel } from '@prisma/client';

describe('Provider Adapters (Unit)', () => {
  describe('InAppProviderAdapter', () => {
    const adapter = new InAppProviderAdapter();

    it('should validate non-empty destination', () => {
      expect(adapter.validateDestination('user-123')).toBe(true);
      expect(adapter.validateDestination('')).toBe(false);
    });

    it('should return immediate success on send', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.IN_APP,
        destination: 'user-123',
        content: 'In-app notification message',
      });
      expect(res.success).toBe(true);
      expect(res.providerKey).toBe('in_app_default');
    });
  });

  describe('SandboxEmailProviderAdapter (INV-454)', () => {
    const adapter = new SandboxEmailProviderAdapter();

    it('should validate RFC email address', () => {
      expect(adapter.validateDestination('valid@example.com')).toBe(true);
      expect(adapter.validateDestination('not-an-email')).toBe(false);
      expect(adapter.validateDestination('')).toBe(false);
    });

    it('should deliver valid email and return providerMessageId', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'user@company.com',
        content: 'Welcome',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBeDefined();
    });

    it('should classify bounce as PERMANENT failure', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'user-bounce@company.com',
        content: 'Welcome',
      });
      expect(res.success).toBe(false);
      expect(res.failureCategory).toBe('PERMANENT');
      expect(res.failureCode).toBe('EMAIL_BOUNCED');
    });

    it('should classify timeout as TRANSIENT failure', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.EMAIL,
        destination: 'user-fail@company.com',
        content: 'Welcome',
      });
      expect(res.success).toBe(false);
      expect(res.failureCategory).toBe('TRANSIENT');
      expect(res.failureCode).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('SandboxPushProviderAdapter (INV-466)', () => {
    const adapter = new SandboxPushProviderAdapter();

    it('should validate token length', () => {
      expect(adapter.validateDestination('fcm_token_1234567890')).toBe(true);
      expect(adapter.validateDestination('short')).toBe(false);
    });

    it('should classify unregistered device token as PERMANENT failure', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.PUSH,
        destination: 'unregistered_device_token_abc',
        content: 'Alert',
      });
      expect(res.success).toBe(false);
      expect(res.failureCategory).toBe('PERMANENT');
      expect(res.failureCode).toBe('DEVICE_UNREGISTERED');
    });
  });

  describe('SandboxSmsProviderAdapter (INV-455)', () => {
    const adapter = new SandboxSmsProviderAdapter();

    it('should validate E.164 international phone format', () => {
      expect(adapter.validateDestination('+14155552671')).toBe(true);
      expect(adapter.validateDestination('+442071838750')).toBe(true);
      expect(adapter.validateDestination('4155552671')).toBe(false);
      expect(adapter.validateDestination('+0123')).toBe(false);
    });

    it('should deliver valid SMS and return sid', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.SMS,
        destination: '+14155552671',
        content: 'SMS code: 123456',
      });
      expect(res.success).toBe(true);
      expect(res.providerMessageId).toBeDefined();
    });

    it('should classify carrier congestion as TRANSIENT failure', async () => {
      const res = await adapter.send({
        organizationId: 'org-1',
        notificationId: 'notif-1',
        recipientId: 'recip-1',
        channel: NotificationChannel.SMS,
        destination: '+14155550000',
        content: 'Test',
      });
      expect(res.success).toBe(false);
      expect(res.failureCategory).toBe('TRANSIENT');
      expect(res.failureCode).toBe('CARRIER_UNREACHABLE');
    });
  });
});
