import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, NotificationTemplateStatus } from '@prisma/client';

@Injectable()
export class TemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createTemplate(data: Prisma.NotificationTemplateCreateInput) {
    return this.prisma.notificationTemplate.create({
      data,
      include: {
        versions: true,
      },
    });
  }

  async findTemplateByKey(organizationId: string | null, key: string) {
    return this.prisma.notificationTemplate.findFirst({
      where: {
        key,
        OR: [
          { organizationId },
          { organizationId: null }, // System global templates
        ],
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
      orderBy: {
        organizationId: 'desc', // Prefer tenant-specific over global null
      },
    });
  }

  async findTemplateById(id: string, organizationId?: string) {
    return this.prisma.notificationTemplate.findFirst({
      where: {
        id,
        ...(organizationId
          ? {
              OR: [{ organizationId }, { organizationId: null }],
            }
          : {}),
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
        },
      },
    });
  }

  async findVersionById(versionId: string) {
    return this.prisma.notificationTemplateVersion.findUnique({
      where: { id: versionId },
      include: {
        template: true,
      },
    });
  }

  async findActiveVersion(templateId: string, locale: string = 'en') {
    // Check for exact locale version first, fallback to 'en'
    const exact = await this.prisma.notificationTemplateVersion.findFirst({
      where: {
        templateId,
        isPublished: true,
        locale,
      },
      orderBy: { version: 'desc' },
    });

    if (exact) return exact;

    return this.prisma.notificationTemplateVersion.findFirst({
      where: {
        templateId,
        isPublished: true,
        locale: 'en',
      },
      orderBy: { version: 'desc' },
    });
  }

  async createVersion(data: Prisma.NotificationTemplateVersionCreateInput) {
    return this.prisma.notificationTemplateVersion.create({
      data,
    });
  }

  async listTemplates(organizationId: string) {
    return this.prisma.notificationTemplate.findMany({
      where: {
        OR: [{ organizationId }, { organizationId: null }],
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 5,
        },
      },
      orderBy: [{ organizationId: 'desc' }, { key: 'asc' }],
    });
  }

  async updateTemplate(
    id: string,
    data: Prisma.NotificationTemplateUpdateInput,
  ) {
    return this.prisma.notificationTemplate.update({
      where: { id },
      data,
      include: {
        versions: true,
      },
    });
  }

  async updateTemplateStatus(id: string, status: NotificationTemplateStatus) {
    return this.prisma.notificationTemplate.update({
      where: { id },
      data: { status },
    });
  }
}
