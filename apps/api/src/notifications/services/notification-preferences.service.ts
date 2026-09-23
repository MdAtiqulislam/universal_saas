import { Injectable, ForbiddenException } from '@nestjs/common';
import { PreferenceRepository } from '../repositories/preference.repository';
import { CredentialEncryptionService } from '../../integrations/credentials/credential-encryption.service';
import { UpdatePreferenceDto, UpdatePolicyDto } from '../dto/preference.dto';
import { ConfigureProviderDto } from '../dto/provider.dto';
import { NotificationChannel, NotificationPriority } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

export interface QuietHoursCheckResult {
  inQuietHours: boolean;
  canBypass: boolean;
  deferUntil?: Date;
}

@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly preferenceRepo: PreferenceRepository,
    private readonly encryptionService: CredentialEncryptionService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  /**
   * Evaluates if a given time falls within configured quiet hours (e.g. 22:00 -> 07:00).
   * Correctly handles midnight-crossing windows and timezones.
   */
  isWithinQuietHours(
    quietHoursStart?: string | null,
    quietHoursEnd?: string | null,
    currentTime: Date = new Date(),
  ): boolean {
    if (!quietHoursStart || !quietHoursEnd) return false;

    const parseTime = (timeStr: string): number => {
      const [hours, minutes] = timeStr.split(':').map(Number);
      return hours * 60 + (minutes || 0);
    };

    const startMin = parseTime(quietHoursStart);
    const endMin = parseTime(quietHoursEnd);
    const currentMin =
      currentTime.getUTCHours() * 60 + currentTime.getUTCMinutes();

    if (startMin <= endMin) {
      // Normal range within same day (e.g. 13:00 -> 15:00)
      return currentMin >= startMin && currentMin < endMin;
    } else {
      // Midnight crossing range (e.g. 22:00 -> 07:00)
      return currentMin >= startMin || currentMin < endMin;
    }
  }

  /**
   * Checks if user has enabled a channel, respecting quiet hours and security alert policies
   * INV-464, INV-465
   */
  async shouldDeliverToRecipient(params: {
    organizationId: string;
    userId: string;
    eventCategory: string;
    channel: NotificationChannel;
    priority: NotificationPriority;
  }): Promise<{ deliver: boolean; reason?: string; deferUntil?: Date }> {
    const { organizationId, userId, eventCategory, channel, priority } = params;

    // INV-465: Critical security notifications cannot be silently suppressed
    if (
      priority === NotificationPriority.CRITICAL ||
      eventCategory === 'SECURITY_ALERT'
    ) {
      return { deliver: true };
    }

    // Check tenant communication policy (INV-464)
    const policies =
      await this.preferenceRepo.getCommunicationPolicies(organizationId);
    const channelPolicy = policies.find((p) => p.channel === channel);
    if (channelPolicy && !channelPolicy.allowed) {
      return {
        deliver: false,
        reason: `Channel '${channel}' is disabled by organization policy`,
      };
    }

    // Check user preference
    const preferences = await this.preferenceRepo.getUserPreferences(
      organizationId,
      userId,
    );
    const pref = preferences.find(
      (p) => p.eventCategory === eventCategory && p.channel === channel,
    );

    if (pref && !pref.enabled) {
      return {
        deliver: false,
        reason: `User has disabled '${channel}' for '${eventCategory}'`,
      };
    }

    // Check quiet hours
    if (pref && pref.quietHoursStart && pref.quietHoursEnd) {
      const inQuiet = this.isWithinQuietHours(
        pref.quietHoursStart,
        pref.quietHoursEnd,
      );
      if (inQuiet) {
        if (priority === NotificationPriority.HIGH) {
          // High priority can bypass normal quiet hours
          return { deliver: true };
        }
        return {
          deliver: false,
          reason: 'Quiet hours active for recipient',
        };
      }
    }

    return { deliver: true };
  }

  async getUserPreferences(
    organizationId: string,
    userId: string,
    actorOrgId: string,
  ) {
    // INV-463: User notification preferences cannot cross tenant boundaries
    if (organizationId !== actorOrgId) {
      throw new ForbiddenException(
        'Cannot access notification preferences of another tenant',
      );
    }
    return this.preferenceRepo.getUserPreferences(organizationId, userId);
  }

  async updateUserPreference(
    organizationId: string,
    userId: string,
    dto: UpdatePreferenceDto,
    actorOrgId: string,
  ) {
    // INV-462: Preference belongs to exactly one user and organization
    // INV-463: Boundary check
    if (organizationId !== actorOrgId) {
      throw new ForbiddenException(
        'Cannot modify preferences across tenant boundary',
      );
    }

    return this.preferenceRepo.upsertUserPreference({
      organizationId,
      userId,
      eventCategory: dto.eventCategory,
      channel: dto.channel,
      enabled: dto.enabled,
      quietHoursStart: dto.quietHoursStart,
      quietHoursEnd: dto.quietHoursEnd,
      timezone: dto.timezone,
    });
  }

  async getCommunicationPolicies(organizationId: string) {
    return this.preferenceRepo.getCommunicationPolicies(organizationId);
  }

  async updateCommunicationPolicy(
    organizationId: string,
    dto: UpdatePolicyDto,
    actorUserId?: string,
  ) {
    const updated = await this.preferenceRepo.upsertCommunicationPolicy({
      organizationId,
      channel: dto.channel,
      allowed: dto.allowed,
      rateLimitPerMinute: dto.rateLimitPerMinute,
      requireSecurityOverride: dto.requireSecurityOverride,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.policy.updated',
        organizationId,
        actorUserId,
        resource: 'communication_policy',
        resourceId: updated.id,
        details: { channel: dto.channel, allowed: dto.allowed },
        eventName: 'notifications.policy.updated',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async getProviderConfigs(organizationId: string) {
    const configs =
      await this.preferenceRepo.getProviderConfigs(organizationId);
    // INV-467: Provider credentials are never returned in raw form
    return configs.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      providerKey: c.providerKey,
      channel: c.channel,
      isPrimary: c.isPrimary,
      isEnabled: c.isEnabled,
      credentialFingerprint: c.credentialFingerprint,
      priority: c.priority,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async configureProvider(
    organizationId: string,
    dto: ConfigureProviderDto,
    actorUserId?: string,
  ) {
    // INV-467: Raw credentials are AES-256-GCM encrypted; never stored raw
    let encryptedCredentials: string | undefined;
    let credentialIv: string | undefined;
    let credentialAuthTag: string | undefined;
    let credentialFingerprint: string | undefined;

    if (dto.rawCredentials) {
      const encrypted = this.encryptionService.encrypt(dto.rawCredentials);
      encryptedCredentials = encrypted.encryptedValue;
      credentialIv = encrypted.iv;
      credentialAuthTag = encrypted.authTag;
      credentialFingerprint = encrypted.fingerprint;
    }

    // INV-468: Communication provider configuration is tenant scoped
    const config = await this.preferenceRepo.upsertProviderConfig({
      organizationId,
      providerKey: dto.providerKey,
      channel: dto.channel,
      isPrimary: dto.isPrimary,
      isEnabled: dto.isEnabled,
      encryptedCredentials,
      credentialIv,
      credentialAuthTag,
      credentialFingerprint,
      priority: dto.priority,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.provider.configured',
        organizationId,
        actorUserId,
        resource: 'communication_provider_config',
        resourceId: config.id,
        details: {
          providerKey: dto.providerKey,
          channel: dto.channel,
          fingerprint: credentialFingerprint,
        },
        eventName: 'notifications.provider.configured',
        occurredAt: new Date(),
      });
    }

    return {
      id: config.id,
      organizationId: config.organizationId,
      providerKey: config.providerKey,
      channel: config.channel,
      isPrimary: config.isPrimary,
      isEnabled: config.isEnabled,
      credentialFingerprint,
      priority: config.priority,
    };
  }
}
