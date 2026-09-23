import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationChannel } from '@prisma/client';

@Injectable()
export class PreferenceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserPreferences(organizationId: string, userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { organizationId, userId },
    });
  }

  async upsertUserPreference(params: {
    organizationId: string;
    userId: string;
    eventCategory: string;
    channel: NotificationChannel;
    enabled: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    timezone?: string;
  }) {
    const {
      organizationId,
      userId,
      eventCategory,
      channel,
      enabled,
      quietHoursStart,
      quietHoursEnd,
      timezone,
    } = params;

    return this.prisma.notificationPreference.upsert({
      where: {
        organizationId_userId_eventCategory_channel: {
          organizationId,
          userId,
          eventCategory,
          channel,
        },
      },
      create: {
        organizationId,
        userId,
        eventCategory,
        channel,
        enabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
      },
      update: {
        enabled,
        quietHoursStart,
        quietHoursEnd,
        timezone,
      },
    });
  }

  async getCommunicationPolicies(organizationId: string) {
    return this.prisma.communicationPolicy.findMany({
      where: { organizationId },
    });
  }

  async upsertCommunicationPolicy(params: {
    organizationId: string;
    channel: NotificationChannel;
    allowed: boolean;
    rateLimitPerMinute?: number;
    requireSecurityOverride?: boolean;
  }) {
    const {
      organizationId,
      channel,
      allowed,
      rateLimitPerMinute,
      requireSecurityOverride,
    } = params;

    return this.prisma.communicationPolicy.upsert({
      where: {
        organizationId_channel: {
          organizationId,
          channel,
        },
      },
      create: {
        organizationId,
        channel,
        allowed,
        rateLimitPerMinute,
        requireSecurityOverride,
      },
      update: {
        allowed,
        rateLimitPerMinute,
        requireSecurityOverride,
      },
    });
  }

  async getProviderConfigs(organizationId?: string) {
    return this.prisma.communicationProviderConfig.findMany({
      where: organizationId
        ? { OR: [{ organizationId }, { organizationId: null }] }
        : {},
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async upsertProviderConfig(params: {
    organizationId?: string;
    providerKey: string;
    channel: NotificationChannel;
    isPrimary?: boolean;
    isEnabled?: boolean;
    encryptedCredentials?: string;
    credentialIv?: string;
    credentialAuthTag?: string;
    credentialFingerprint?: string;
    priority?: number;
  }) {
    const {
      organizationId,
      providerKey,
      channel,
      isPrimary,
      isEnabled,
      encryptedCredentials,
      credentialIv,
      credentialAuthTag,
      credentialFingerprint,
      priority,
    } = params;

    const orgId = organizationId || null;

    return this.prisma.communicationProviderConfig.upsert({
      where: {
        organizationId_channel_providerKey: {
          organizationId: orgId as unknown as string,
          channel,
          providerKey,
        },
      },
      create: {
        organizationId: orgId,
        providerKey,
        channel,
        isPrimary: isPrimary ?? true,
        isEnabled: isEnabled ?? true,
        encryptedCredentials,
        credentialIv,
        credentialAuthTag,
        credentialFingerprint,
        priority: priority ?? 1,
      },
      update: {
        isPrimary,
        isEnabled,
        ...(encryptedCredentials
          ? {
              encryptedCredentials,
              credentialIv,
              credentialAuthTag,
              credentialFingerprint,
            }
          : {}),
        priority,
      },
    });
  }
}
