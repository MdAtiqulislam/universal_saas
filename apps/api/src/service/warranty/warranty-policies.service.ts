import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  CreateWarrantyPolicyDto,
  UpdateWarrantyPolicyDto,
  AssignAssetWarrantyDto,
} from '../dto/warranty-policy.dto';
import { WarrantyPolicy, WarrantyCoverageType, Prisma } from '@prisma/client';

@Injectable()
export class WarrantyPoliciesService {
  private readonly logger = new Logger(WarrantyPoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean },
  ): Promise<WarrantyPolicy[]> {
    const where: Prisma.WarrantyPolicyWhereInput = { organizationId };
    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    return this.prisma.warrantyPolicy.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string): Promise<WarrantyPolicy> {
    const policy = await this.prisma.warrantyPolicy.findFirst({
      where: { id, organizationId },
    });

    if (!policy) {
      throw new NotFoundException(
        `Warranty policy with ID ${id} not found in this organization.`,
      );
    }

    return policy;
  }

  async create(
    organizationId: string,
    dto: CreateWarrantyPolicyDto,
    userId: string,
  ): Promise<WarrantyPolicy> {
    const existing = await this.prisma.warrantyPolicy.findFirst({
      where: { organizationId, code: dto.code },
    });

    if (existing) {
      throw new ConflictException(
        `Warranty policy with code '${dto.code}' already exists in this organization.`,
      );
    }

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'Policy effectiveTo date cannot be earlier than effectiveFrom date.',
      );
    }

    const policy = await this.prisma.warrantyPolicy.create({
      data: {
        organizationId,
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
        durationMonths: dto.durationMonths,
        coverageType: dto.coverageType || WarrantyCoverageType.FULL,
        laborCovered: dto.laborCovered ?? true,
        partsCovered: dto.partsCovered ?? true,
        replacementCovered: dto.replacementCovered ?? false,
        inspectionRequired: dto.inspectionRequired ?? true,
        exclusions: dto.exclusions || null,
        effectiveFrom,
        effectiveTo,
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'WARRANTY_POLICY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'create',
      resource: 'warranty_policy',
      resourceId: policy.id,
      details: {
        code: policy.code,
        name: policy.name,
        coverageType: policy.coverageType,
      },
    });

    return policy;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateWarrantyPolicyDto,
    userId: string,
  ): Promise<WarrantyPolicy> {
    const existing = await this.findOne(organizationId, id);

    const effectiveTo = dto.effectiveTo
      ? new Date(dto.effectiveTo)
      : existing.effectiveTo;
    if (effectiveTo && effectiveTo < existing.effectiveFrom) {
      throw new BadRequestException(
        'Policy effectiveTo date cannot be earlier than effectiveFrom date.',
      );
    }

    const updated = await this.prisma.warrantyPolicy.update({
      where: { id: existing.id },
      data: {
        name: dto.name ? dto.name.trim() : existing.name,
        durationMonths: dto.durationMonths ?? existing.durationMonths,
        coverageType: dto.coverageType ?? existing.coverageType,
        laborCovered: dto.laborCovered ?? existing.laborCovered,
        partsCovered: dto.partsCovered ?? existing.partsCovered,
        replacementCovered:
          dto.replacementCovered ?? existing.replacementCovered,
        inspectionRequired:
          dto.inspectionRequired ?? existing.inspectionRequired,
        exclusions:
          dto.exclusions !== undefined ? dto.exclusions : existing.exclusions,
        effectiveTo,
        isActive: dto.isActive ?? existing.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'WARRANTY_POLICY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'update',
      resource: 'warranty_policy',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
        isActive: updated.isActive,
      },
    });

    return updated;
  }

  async assignAssetWarranty(
    organizationId: string,
    customerAssetId: string,
    dto: AssignAssetWarrantyDto,
    userId: string,
  ) {
    const asset = await this.prisma.customerAsset.findFirst({
      where: { id: customerAssetId, organizationId },
    });
    if (!asset) {
      throw new NotFoundException(
        `Customer asset with ID ${customerAssetId} not found in this organization.`,
      );
    }

    const policy = await this.findOne(organizationId, dto.warrantyPolicyId);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException(
        'Warranty end date cannot be earlier than start date.',
      );
    }

    const assignment = await this.prisma.customerAssetWarranty.create({
      data: {
        organizationId,
        customerAssetId: asset.id,
        warrantyPolicyId: policy.id,
        startDate,
        endDate,
        status: dto.status || asset.warrantyStatus,
        claimLimitAmount: dto.claimLimitAmount
          ? new Prisma.Decimal(dto.claimLimitAmount)
          : null,
        notes: dto.notes || null,
      },
      include: {
        warrantyPolicy: true,
      },
    });

    return assignment;
  }
}
