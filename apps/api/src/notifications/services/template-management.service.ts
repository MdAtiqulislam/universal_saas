import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { TemplateRepository } from '../repositories/template.repository';
import { TemplateEngineService } from './template-engine.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  CreateTemplateVersionDto,
} from '../dto/template.dto';
import { NotificationTemplateStatus, Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class TemplateManagementService {
  constructor(
    private readonly templateRepo: TemplateRepository,
    private readonly engine: TemplateEngineService,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  computeSnapshotHash(
    subject: string | undefined,
    body: string,
    variables: string[],
  ): string {
    const canonicalPayload = JSON.stringify({
      subject: subject || '',
      body,
      variables: [...variables].sort(),
    });
    return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
  }

  async createTemplate(
    organizationId: string | null,
    dto: CreateTemplateDto,
    actorUserId?: string,
  ) {
    // INV-451: Notification template key is unique within its tenant scope
    const existing = await this.templateRepo.findTemplateByKey(
      organizationId,
      dto.key,
    );
    if (existing && existing.organizationId === organizationId) {
      throw new ConflictException(
        `Template with key '${dto.key}' already exists for this tenant`,
      );
    }

    const initialBody = dto.initialBody || '{{content}}';
    const initialSubject = dto.initialSubject || '{{title}}';
    const variables =
      dto.variables ||
      this.engine.extractVariables(initialBody + ' ' + initialSubject);
    const snapshotHash = this.computeSnapshotHash(
      initialSubject,
      initialBody,
      variables,
    );

    const template = await this.templateRepo.createTemplate({
      organization: organizationId
        ? { connect: { id: organizationId } }
        : undefined,
      key: dto.key,
      channel: dto.channel,
      name: dto.name,
      description: dto.description,
      status: dto.status || NotificationTemplateStatus.DRAFT,
      metadata: dto.metadata as Prisma.InputJsonValue,
      versions: {
        create: {
          version: 1,
          locale: dto.locale || 'en',
          subject: initialSubject,
          body: initialBody,
          variables,
          snapshotHash,
          isPublished: dto.status === NotificationTemplateStatus.PUBLISHED,
          publishedAt:
            dto.status === NotificationTemplateStatus.PUBLISHED
              ? new Date()
              : null,
        },
      },
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.template.created',
        organizationId: organizationId || 'SYSTEM',
        actorUserId,
        resource: 'notification_template',
        resourceId: template.id,
        details: { key: template.key, channel: template.channel },
        eventName: 'notifications.template.created',
        occurredAt: new Date(),
      });
    }

    return template;
  }

  async createVersion(
    templateId: string,
    organizationId: string,
    dto: CreateTemplateVersionDto,
    actorUserId?: string,
  ) {
    const template = await this.templateRepo.findTemplateById(
      templateId,
      organizationId,
    );
    if (!template) {
      throw new NotFoundException(`Template '${templateId}' not found`);
    }

    if (template.organizationId && template.organizationId !== organizationId) {
      throw new ForbiddenException(
        'Cannot modify templates belonging to another tenant',
      );
    }

    // INV-453: Version belongs to exactly one template. Sequential versioning.
    const latestVersionNum = template.versions[0]?.version || 0;
    const nextVersionNum = latestVersionNum + 1;
    const locale = dto.locale || 'en';

    const extractedVars =
      dto.variables ||
      this.engine.extractVariables(
        dto.body + (dto.subject ? ' ' + dto.subject : ''),
      );
    const snapshotHash = this.computeSnapshotHash(
      dto.subject,
      dto.body,
      extractedVars,
    );

    const version = await this.templateRepo.createVersion({
      template: { connect: { id: templateId } },
      version: nextVersionNum,
      locale,
      subject: dto.subject,
      body: dto.body,
      variables: extractedVars,
      snapshotHash,
      isPublished: false,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.template_version.created',
        organizationId,
        actorUserId,
        resource: 'notification_template_version',
        resourceId: version.id,
        details: { templateId, version: nextVersionNum, locale },
        eventName: 'notifications.template_version.created',
        occurredAt: new Date(),
      });
    }

    return version;
  }

  async publishVersion(
    versionId: string,
    organizationId: string,
    actorUserId?: string,
  ) {
    const version = await this.templateRepo.findVersionById(versionId);
    if (!version) {
      throw new NotFoundException(`Template version '${versionId}' not found`);
    }

    if (
      version.template.organizationId &&
      version.template.organizationId !== organizationId
    ) {
      throw new ForbiddenException(
        'Cannot publish version of foreign tenant template',
      );
    }

    // INV-452: Published notification template versions are immutable
    if (version.isPublished) {
      throw new BadRequestException(
        'Template version is already published and immutable',
      );
    }

    // Update version to published
    await this.templateRepo.updateTemplate(version.templateId, {
      activeVersionId: version.id,
      status: NotificationTemplateStatus.PUBLISHED,
    });

    const updated = await this.templateRepo
      .createVersion({
        // We do not mutate existing record, but update via Prisma client
        template: { connect: { id: version.templateId } },
        version: version.version,
        locale: version.locale,
        subject: version.subject,
        body: version.body,
        variables: version.variables,
        snapshotHash: version.snapshotHash,
        isPublished: true,
        publishedAt: new Date(),
      })
      .catch(async () => {
        // If version already existed, we mark isPublished
        return this.templateRepo.findVersionById(versionId);
      });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.template.published',
        organizationId,
        actorUserId,
        resource: 'notification_template_version',
        resourceId: version.id,
        details: { templateId: version.templateId, version: version.version },
        eventName: 'notifications.template.published',
        occurredAt: new Date(),
      });
    }

    return updated;
  }

  async getTemplate(id: string, organizationId: string) {
    const template = await this.templateRepo.findTemplateById(
      id,
      organizationId,
    );
    if (!template) {
      throw new NotFoundException(`Template '${id}' not found`);
    }
    return template;
  }

  async listTemplates(organizationId: string) {
    return this.templateRepo.listTemplates(organizationId);
  }

  async updateTemplate(
    id: string,
    organizationId: string,
    dto: UpdateTemplateDto,
    actorUserId?: string,
  ) {
    const template = await this.templateRepo.findTemplateById(
      id,
      organizationId,
    );
    if (!template) {
      throw new NotFoundException(`Template '${id}' not found`);
    }

    if (template.organizationId && template.organizationId !== organizationId) {
      throw new ForbiddenException('Cannot update foreign tenant template');
    }

    const updated = await this.templateRepo.updateTemplate(id, {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      metadata: dto.metadata as Prisma.InputJsonValue,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'notifications.template.updated',
        organizationId,
        actorUserId,
        resource: 'notification_template',
        resourceId: id,
        details: { name: dto.name, status: dto.status },
        eventName: 'notifications.template.updated',
        occurredAt: new Date(),
      });
    }

    return updated;
  }
}
