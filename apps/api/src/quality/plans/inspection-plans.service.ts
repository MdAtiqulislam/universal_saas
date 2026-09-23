import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import {
  CreateInspectionPlanDto,
  UpdateInspectionPlanDto,
  QueryInspectionPlansDto,
} from './dto/inspection-plan.dto';
import { Prisma, InspectionType } from '@prisma/client';

@Injectable()
export class InspectionPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
  ) {}

  async findAll(organizationId: string, query?: QueryInspectionPlansDto) {
    const where: Prisma.InspectionPlanWhereInput = { organizationId };

    if (query?.itemId) {
      where.itemId = query.itemId;
    }
    if (query?.inspectionType) {
      where.inspectionType = query.inspectionType;
    }
    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query?.search) {
      where.OR = [
        { planNumber: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.inspectionPlan.findMany({
      where,
      orderBy: [{ planNumber: 'asc' }, { version: 'desc' }],
      include: {
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        samplingPlan: true,
        characteristics: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { inspectionLots: true },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const plan = await this.prisma.inspectionPlan.findFirst({
      where: { id, organizationId },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        samplingPlan: true,
        characteristics: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { inspectionLots: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Inspection plan ${id} not found`);
    }

    return plan;
  }

  async create(
    organizationId: string,
    dto: CreateInspectionPlanDto,
    userId: string,
  ) {
    // Validate Item
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: { id: dto.variantId, itemId: dto.itemId, organizationId },
      });
      if (!variant) {
        throw new NotFoundException(`Item variant ${dto.variantId} not found`);
      }
    }

    if (dto.samplingPlanId) {
      const sp = await this.prisma.samplingPlan.findFirst({
        where: { id: dto.samplingPlanId, organizationId },
      });
      if (!sp) {
        throw new NotFoundException(
          `Sampling plan ${dto.samplingPlanId} not found`,
        );
      }
    }

    const version = dto.version ?? 1;

    // Check unique plan for item/variant/type/version
    const existing = await this.prisma.inspectionPlan.findFirst({
      where: {
        organizationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        inspectionType: dto.inspectionType,
        version,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Inspection plan for this item and inspection type (version ${version}) already exists`,
      );
    }

    let planNumber = dto.planNumber;
    if (!planNumber) {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'INSPECTION_PLAN',
        'QIP-',
      );
      planNumber = seq.formatted;
    }

    const plan = await this.prisma.inspectionPlan.create({
      data: {
        organizationId,
        planNumber,
        name: dto.name,
        version,
        description: dto.description,
        itemId: dto.itemId,
        variantId: dto.variantId,
        inspectionType: dto.inspectionType,
        samplingPlanId: dto.samplingPlanId,
        isActive: dto.isActive ?? true,
        isImmutable: false,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        characteristics: {
          create: (dto.characteristics ?? []).map((c, idx) => ({
            organizationId,
            sequence: c.sequence ?? idx + 1,
            code: c.code,
            name: c.name,
            description: c.description,
            dataType: c.dataType,
            unitOfMeasure: c.unitOfMeasure,
            targetValue:
              c.targetValue !== undefined
                ? new Prisma.Decimal(c.targetValue)
                : null,
            minSpec:
              c.minSpec !== undefined ? new Prisma.Decimal(c.minSpec) : null,
            maxSpec:
              c.maxSpec !== undefined ? new Prisma.Decimal(c.maxSpec) : null,
            tolerance:
              c.tolerance !== undefined
                ? new Prisma.Decimal(c.tolerance)
                : null,
            isMandatory: c.isMandatory ?? true,
            acceptanceCriteria: c.acceptanceCriteria,
          })),
        },
      },
      include: {
        item: true,
        variant: true,
        samplingPlan: true,
        characteristics: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'INSPECTION_PLAN_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.inspection_plan.create',
      resource: 'inspection_plan',
      resourceId: plan.id,
      details: {
        planNumber: plan.planNumber,
        itemId: plan.itemId,
        version: plan.version,
      },
    });

    return plan;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateInspectionPlanDto,
    userId: string,
  ) {
    const plan = await this.findOne(organizationId, id);

    if (plan.isImmutable || (plan._count && plan._count.inspectionLots > 0)) {
      throw new BadRequestException(
        'Cannot modify immutable inspection plan referenced by inspection lots. Create a new version instead.',
      );
    }

    if (dto.samplingPlanId) {
      const sp = await this.prisma.samplingPlan.findFirst({
        where: { id: dto.samplingPlanId, organizationId },
      });
      if (!sp) {
        throw new NotFoundException(
          `Sampling plan ${dto.samplingPlanId} not found`,
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.characteristics) {
        // Replace characteristics
        await tx.inspectionCharacteristic.deleteMany({
          where: { inspectionPlanId: plan.id, organizationId },
        });

        await tx.inspectionCharacteristic.createMany({
          data: dto.characteristics.map((c, idx) => ({
            organizationId,
            inspectionPlanId: plan.id,
            sequence: c.sequence ?? idx + 1,
            code: c.code,
            name: c.name,
            description: c.description,
            dataType: c.dataType,
            unitOfMeasure: c.unitOfMeasure,
            targetValue:
              c.targetValue !== undefined
                ? new Prisma.Decimal(c.targetValue)
                : null,
            minSpec:
              c.minSpec !== undefined ? new Prisma.Decimal(c.minSpec) : null,
            maxSpec:
              c.maxSpec !== undefined ? new Prisma.Decimal(c.maxSpec) : null,
            tolerance:
              c.tolerance !== undefined
                ? new Prisma.Decimal(c.tolerance)
                : null,
            isMandatory: c.isMandatory ?? true,
            acceptanceCriteria: c.acceptanceCriteria,
          })),
        });
      }

      const updated = await tx.inspectionPlan.update({
        where: { id: plan.id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.samplingPlanId !== undefined && {
            samplingPlanId: dto.samplingPlanId,
          }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.effectiveFrom !== undefined && {
            effectiveFrom: dto.effectiveFrom
              ? new Date(dto.effectiveFrom)
              : null,
          }),
          ...(dto.effectiveTo !== undefined && {
            effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
          }),
        },
        include: {
          item: true,
          variant: true,
          samplingPlan: true,
          characteristics: { orderBy: { sequence: 'asc' } },
        },
      });

      await this.eventBus.publish({
        eventName: 'INSPECTION_PLAN_UPDATED',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId ?? null,
        action: 'quality.inspection_plan.update',
        resource: 'inspection_plan',
        resourceId: updated.id,
        details: { planNumber: updated.planNumber, version: updated.version },
      });

      return updated;
    });
  }

  async activate(organizationId: string, id: string, userId: string) {
    const plan = await this.findOne(organizationId, id);

    const updated = await this.prisma.inspectionPlan.update({
      where: { id: plan.id },
      data: {
        isActive: true,
        approvedByUserId: userId,
        approvedAt: new Date(),
      },
    });

    await this.eventBus.publish({
      eventName: 'INSPECTION_PLAN_ACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.inspection_plan.activate',
      resource: 'inspection_plan',
      resourceId: updated.id,
      details: { planNumber: updated.planNumber },
    });

    return updated;
  }

  async deactivate(organizationId: string, id: string, userId: string) {
    const plan = await this.findOne(organizationId, id);

    const updated = await this.prisma.inspectionPlan.update({
      where: { id: plan.id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventName: 'INSPECTION_PLAN_DEACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.inspection_plan.deactivate',
      resource: 'inspection_plan',
      resourceId: updated.id,
      details: { planNumber: updated.planNumber },
    });

    return updated;
  }

  async findActivePlanForItem(
    organizationId: string,
    itemId: string,
    variantId?: string | null,
    inspectionType?: InspectionType,
  ) {
    const now = new Date();
    return this.prisma.inspectionPlan.findFirst({
      where: {
        organizationId,
        itemId,
        variantId: variantId ?? null,
        ...(inspectionType && { inspectionType }),
        isActive: true,
        OR: [
          { effectiveFrom: null, effectiveTo: null },
          { effectiveFrom: { lte: now }, effectiveTo: null },
          { effectiveFrom: null, effectiveTo: { gte: now } },
          { effectiveFrom: { lte: now }, effectiveTo: { gte: now } },
        ],
      },
      orderBy: { version: 'desc' },
      include: {
        samplingPlan: true,
        characteristics: { orderBy: { sequence: 'asc' } },
      },
    });
  }
}
