import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import {
  CreateSamplingPlanDto,
  UpdateSamplingPlanDto,
  QuerySamplingPlansDto,
} from './dto/sampling-plan.dto';
import { Prisma, SamplingType } from '@prisma/client';

@Injectable()
export class SamplingPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async findAll(organizationId: string, query?: QuerySamplingPlansDto) {
    const where: Prisma.SamplingPlanWhereInput = { organizationId };

    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.samplingPlan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { inspectionPlans: true },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const plan = await this.prisma.samplingPlan.findFirst({
      where: { id, organizationId },
      include: {
        _count: {
          select: { inspectionPlans: true },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException(`Sampling plan ${id} not found`);
    }

    return plan;
  }

  async create(
    organizationId: string,
    dto: CreateSamplingPlanDto,
    userId: string,
  ) {
    const existing = await this.prisma.samplingPlan.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: dto.code,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Sampling plan with code "${dto.code}" already exists`,
      );
    }

    this.validateSamplingRules(
      dto.samplingType,
      dto.fixedSampleQuantity,
      dto.percentageRate,
    );

    const plan = await this.prisma.samplingPlan.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        samplingType: dto.samplingType,
        fixedSampleQuantity: dto.fixedSampleQuantity
          ? new Prisma.Decimal(dto.fixedSampleQuantity)
          : null,
        percentageRate: dto.percentageRate
          ? new Prisma.Decimal(dto.percentageRate)
          : null,
        lotRangesJson: dto.lotRangesJson
          ? (dto.lotRangesJson as Prisma.InputJsonValue)
          : undefined,
        isActive: dto.isActive ?? true,
      },
    });

    await this.eventBus.publish({
      eventName: 'SAMPLING_PLAN_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.sampling_plan.create',
      resource: 'sampling_plan',
      resourceId: plan.id,
      details: { code: plan.code, samplingType: plan.samplingType },
    });

    return plan;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateSamplingPlanDto,
    userId: string,
  ) {
    const plan = await this.findOne(organizationId, id);

    const type = dto.samplingType ?? plan.samplingType;
    const fixedQty =
      dto.fixedSampleQuantity !== undefined
        ? dto.fixedSampleQuantity
        : plan.fixedSampleQuantity
          ? plan.fixedSampleQuantity.toNumber()
          : undefined;
    const rate =
      dto.percentageRate !== undefined
        ? dto.percentageRate
        : plan.percentageRate
          ? plan.percentageRate.toNumber()
          : undefined;

    this.validateSamplingRules(type, fixedQty, rate);

    const updated = await this.prisma.samplingPlan.update({
      where: { id: plan.id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.samplingType !== undefined && {
          samplingType: dto.samplingType,
        }),
        ...(dto.fixedSampleQuantity !== undefined && {
          fixedSampleQuantity: dto.fixedSampleQuantity
            ? new Prisma.Decimal(dto.fixedSampleQuantity)
            : null,
        }),
        ...(dto.percentageRate !== undefined && {
          percentageRate: dto.percentageRate
            ? new Prisma.Decimal(dto.percentageRate)
            : null,
        }),
        ...(dto.lotRangesJson !== undefined && {
          lotRangesJson: dto.lotRangesJson as Prisma.InputJsonValue,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    await this.eventBus.publish({
      eventName: 'SAMPLING_PLAN_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.sampling_plan.update',
      resource: 'sampling_plan',
      resourceId: updated.id,
      details: { code: updated.code, samplingType: updated.samplingType },
    });

    return updated;
  }

  calculateSampleQuantity(
    plan: {
      samplingType: SamplingType;
      fixedSampleQuantity?: Prisma.Decimal | null;
      percentageRate?: Prisma.Decimal | null;
      lotRangesJson?: any;
    },
    totalQuantity: Prisma.Decimal,
  ): Prisma.Decimal {
    const total = totalQuantity.toNumber();
    if (total <= 0) {
      return new Prisma.Decimal(0);
    }

    switch (plan.samplingType) {
      case SamplingType.FULL_100_PERCENT:
        return totalQuantity;

      case SamplingType.FIXED_QUANTITY: {
        if (!plan.fixedSampleQuantity) return totalQuantity;
        const fixed = plan.fixedSampleQuantity.toNumber();
        const sample = Math.min(fixed, total);
        return new Prisma.Decimal(sample);
      }

      case SamplingType.PERCENTAGE_BASED: {
        if (!plan.percentageRate) return totalQuantity;
        const rate = plan.percentageRate.toNumber();
        const calculated = Math.ceil((total * rate) / 100);
        const sample = Math.max(1, Math.min(calculated, total));
        return new Prisma.Decimal(sample);
      }

      case SamplingType.LOT_SIZE_BASED: {
        if (plan.lotRangesJson && Array.isArray(plan.lotRangesJson)) {
          const ranges = plan.lotRangesJson as Array<{
            minLot?: number;
            maxLot?: number;
            sampleSize?: number;
          }>;
          for (const range of ranges) {
            const min = typeof range.minLot === 'number' ? range.minLot : 0;
            const max =
              typeof range.maxLot === 'number' ? range.maxLot : Infinity;
            if (total >= min && total <= max) {
              const sampleSize =
                typeof range.sampleSize === 'number' ? range.sampleSize : total;
              return new Prisma.Decimal(Math.min(sampleSize, total));
            }
          }
        }
        return totalQuantity;
      }

      default:
        return totalQuantity;
    }
  }

  private validateSamplingRules(
    type: SamplingType,
    fixedQuantity?: number,
    percentageRate?: number,
  ) {
    if (
      type === SamplingType.FIXED_QUANTITY &&
      (fixedQuantity === undefined || fixedQuantity <= 0)
    ) {
      throw new BadRequestException(
        'Fixed quantity sampling plan requires a positive fixedSampleQuantity',
      );
    }

    if (
      type === SamplingType.PERCENTAGE_BASED &&
      (percentageRate === undefined ||
        percentageRate <= 0 ||
        percentageRate > 100)
    ) {
      throw new BadRequestException(
        'Percentage based sampling plan requires percentageRate between 0.01 and 100',
      );
    }
  }
}
