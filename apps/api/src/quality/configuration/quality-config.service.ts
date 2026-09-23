import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { UpdateQualityConfigDto } from './dto/quality-config.dto';
import { InspectionType } from '@prisma/client';

@Injectable()
export class QualityConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async getConfig(organizationId: string) {
    let config = await this.prisma.qualityConfiguration.findUnique({
      where: { organizationId },
      include: {
        defaultSamplingPlan: true,
      },
    });

    if (!config) {
      config = await this.prisma.qualityConfiguration.create({
        data: {
          organizationId,
          defaultInspectionType: InspectionType.INCOMING_PURCHASE,
          autoCreateIncomingLots: false,
          autoCreateFinishedGoodsLots: false,
          autoCreateOutgoingLots: false,
          holdOnFailure: true,
          requireAllMandatoryCharacteristics: true,
        },
        include: {
          defaultSamplingPlan: true,
        },
      });
    }

    return config;
  }

  async updateConfig(
    organizationId: string,
    dto: UpdateQualityConfigDto,
    userId: string,
  ) {
    if (dto.defaultSamplingPlanId) {
      const plan = await this.prisma.samplingPlan.findFirst({
        where: { id: dto.defaultSamplingPlanId, organizationId },
      });
      if (!plan) {
        throw new NotFoundException(
          `Sampling plan ${dto.defaultSamplingPlanId} not found`,
        );
      }
    }

    const config = await this.prisma.qualityConfiguration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        defaultInspectionType:
          dto.defaultInspectionType ?? InspectionType.INCOMING_PURCHASE,
        autoCreateIncomingLots: dto.autoCreateIncomingLots ?? false,
        autoCreateFinishedGoodsLots: dto.autoCreateFinishedGoodsLots ?? false,
        autoCreateOutgoingLots: dto.autoCreateOutgoingLots ?? false,
        holdOnFailure: dto.holdOnFailure ?? true,
        requireAllMandatoryCharacteristics:
          dto.requireAllMandatoryCharacteristics ?? true,
        defaultSamplingPlanId: dto.defaultSamplingPlanId,
      },
      update: {
        ...(dto.defaultInspectionType !== undefined && {
          defaultInspectionType: dto.defaultInspectionType,
        }),
        ...(dto.autoCreateIncomingLots !== undefined && {
          autoCreateIncomingLots: dto.autoCreateIncomingLots,
        }),
        ...(dto.autoCreateFinishedGoodsLots !== undefined && {
          autoCreateFinishedGoodsLots: dto.autoCreateFinishedGoodsLots,
        }),
        ...(dto.autoCreateOutgoingLots !== undefined && {
          autoCreateOutgoingLots: dto.autoCreateOutgoingLots,
        }),
        ...(dto.holdOnFailure !== undefined && {
          holdOnFailure: dto.holdOnFailure,
        }),
        ...(dto.requireAllMandatoryCharacteristics !== undefined && {
          requireAllMandatoryCharacteristics:
            dto.requireAllMandatoryCharacteristics,
        }),
        ...(dto.defaultSamplingPlanId !== undefined && {
          defaultSamplingPlanId: dto.defaultSamplingPlanId,
        }),
      },
      include: {
        defaultSamplingPlan: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'QUALITY_CONFIGURATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.configuration.update',
      resource: 'quality_configuration',
      resourceId: config.id,
      details: {
        defaultInspectionType: config.defaultInspectionType,
        holdOnFailure: config.holdOnFailure,
      },
    });

    return config;
  }
}
