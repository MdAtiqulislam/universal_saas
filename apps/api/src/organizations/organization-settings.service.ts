import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';
import { Prisma } from '@prisma/client';

export interface SanitizedOrganizationSettings {
  id: string;
  organizationId: string;
  currency: string;
  timezone: string;
  fiscalYearStart: number;
  customFields: unknown;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class OrganizationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieve settings for an organization.
   */
  async getSettings(
    orgId: string,
    userId: string,
  ): Promise<SanitizedOrganizationSettings> {
    await this.validateMembership(orgId, userId);

    const settings = await this.prisma.organizationSetting.findUnique({
      where: { organizationId: orgId },
    });

    if (!settings) {
      throw new NotFoundException('Settings not found for this organization');
    }

    return {
      id: settings.id,
      organizationId: settings.organizationId,
      currency: settings.currency,
      timezone: settings.timezone,
      fiscalYearStart: settings.fiscalYearStart,
      customFields: settings.customFields,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Update settings for an organization.
   */
  async updateSettings(
    orgId: string,
    dto: UpdateOrganizationSettingsDto,
    userId: string,
  ): Promise<SanitizedOrganizationSettings> {
    await this.validateMembership(orgId, userId);

    const customFieldsJson =
      dto.customFields !== undefined
        ? (dto.customFields as Prisma.InputJsonValue)
        : undefined;

    const settings = await this.prisma.organizationSetting.upsert({
      where: { organizationId: orgId },
      update: {
        currency: dto.currency,
        timezone: dto.timezone,
        fiscalYearStart: dto.fiscalYearStart,
        customFields: customFieldsJson,
      },
      create: {
        organizationId: orgId,
        currency: dto.currency ?? 'USD',
        timezone: dto.timezone ?? 'UTC',
        fiscalYearStart: dto.fiscalYearStart ?? 1,
        customFields: customFieldsJson ?? Prisma.JsonNull,
      },
    });

    return {
      id: settings.id,
      organizationId: settings.organizationId,
      currency: settings.currency,
      timezone: settings.timezone,
      fiscalYearStart: settings.fiscalYearStart,
      customFields: settings.customFields,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Validate that the user is an active member of the organization.
   */
  private async validateMembership(
    orgId: string,
    userId: string,
  ): Promise<void> {
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        organizationId_userId: {
          organizationId: orgId,
          userId,
        },
      },
    });

    if (!member || member.deletedAt !== null || member.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'User is not an active member of this organization',
      );
    }
  }
}
