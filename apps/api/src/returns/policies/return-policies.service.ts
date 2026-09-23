import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { UpdateReturnPolicyDto } from './dto/return-policy.dto';
import { ReturnPolicy, Prisma } from '@prisma/client';

@Injectable()
export class ReturnPoliciesService {
  private readonly logger = new Logger(ReturnPoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async getPolicy(organizationId: string): Promise<ReturnPolicy> {
    let policy = await this.prisma.returnPolicy.findUnique({
      where: { organizationId },
    });

    if (!policy) {
      policy = await this.prisma.returnPolicy.create({
        data: {
          organizationId,
          returnWindowDays: 30,
          requireOriginalShipment: false,
          requireOriginalInvoice: false,
          allowPartialReturns: true,
          requireInspection: true,
          autoQuarantine: true,
          maxReplacementQty: new Prisma.Decimal(100),
          allowRestocking: true,
          autoCreateCreditNote: false,
        },
      });
    }

    return policy;
  }

  async updatePolicy(
    organizationId: string,
    dto: UpdateReturnPolicyDto,
    actorUserId?: string,
  ): Promise<ReturnPolicy> {
    const data: Prisma.ReturnPolicyUpdateInput = {};

    if (dto.returnWindowDays !== undefined) {
      data.returnWindowDays = dto.returnWindowDays;
    }
    if (dto.requireOriginalShipment !== undefined) {
      data.requireOriginalShipment = dto.requireOriginalShipment;
    }
    if (dto.requireOriginalInvoice !== undefined) {
      data.requireOriginalInvoice = dto.requireOriginalInvoice;
    }
    if (dto.allowPartialReturns !== undefined) {
      data.allowPartialReturns = dto.allowPartialReturns;
    }
    if (dto.requireInspection !== undefined) {
      data.requireInspection = dto.requireInspection;
    }
    if (dto.autoQuarantine !== undefined) {
      data.autoQuarantine = dto.autoQuarantine;
    }
    if (dto.maxReplacementQty !== undefined) {
      data.maxReplacementQty = new Prisma.Decimal(dto.maxReplacementQty);
    }
    if (dto.allowRestocking !== undefined) {
      data.allowRestocking = dto.allowRestocking;
    }
    if (dto.autoCreateCreditNote !== undefined) {
      data.autoCreateCreditNote = dto.autoCreateCreditNote;
    }

    const policy = await this.prisma.returnPolicy.upsert({
      where: { organizationId },
      create: {
        organizationId,
        returnWindowDays: dto.returnWindowDays ?? 30,
        requireOriginalShipment: dto.requireOriginalShipment ?? false,
        requireOriginalInvoice: dto.requireOriginalInvoice ?? false,
        allowPartialReturns: dto.allowPartialReturns ?? true,
        requireInspection: dto.requireInspection ?? true,
        autoQuarantine: dto.autoQuarantine ?? true,
        maxReplacementQty: new Prisma.Decimal(dto.maxReplacementQty ?? 100),
        allowRestocking: dto.allowRestocking ?? true,
        autoCreateCreditNote: dto.autoCreateCreditNote ?? false,
      },
      update: data,
    });

    await this.eventBus.publish({
      eventName: 'RETURN_POLICY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'returns.policies.update',
      resource: 'return_policy',
      resourceId: policy.id,
      details: {
        returnWindowDays: policy.returnWindowDays,
        requireInspection: policy.requireInspection,
        autoQuarantine: policy.autoQuarantine,
      },
    });

    return policy;
  }
}
