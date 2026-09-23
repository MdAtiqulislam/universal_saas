import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto';
import { TaxRuleTransactionType } from '@prisma/client';

export interface MatchTaxRuleParams {
  transactionDate: Date;
  transactionType: TaxRuleTransactionType;
  customerId?: string | null;
  supplierId?: string | null;
  customerGroupId?: string | null;
  itemId?: string | null;
  itemCategoryId?: string | null;
  jurisdictionId?: string | null;
}

@Injectable()
export class TaxRulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateTaxRuleDto,
    actorUserId?: string,
  ) {
    const taxCode = await this.prisma.taxCode.findFirst({
      where: { id: dto.taxCodeId, organizationId },
    });
    if (!taxCode) {
      throw new NotFoundException('Specified tax code not found.');
    }

    const rule = await this.prisma.taxRule.create({
      data: {
        organizationId,
        name: dto.name,
        priority: dto.priority ?? 100,
        transactionType: dto.transactionType ?? TaxRuleTransactionType.BOTH,
        taxCodeId: dto.taxCodeId,
        jurisdictionId: dto.jurisdictionId,
        customerGroupId: dto.customerGroupId,
        customerId: dto.customerId,
        supplierId: dto.supplierId,
        itemCategoryId: dto.itemCategoryId,
        itemId: dto.itemId,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : null,
        effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
        isActive: dto.isActive ?? true,
      },
      include: {
        taxCode: { include: { rates: true } },
        jurisdiction: true,
        customer: true,
        supplier: true,
        customerGroup: true,
        itemCategory: true,
        item: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_RULE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_rule.created',
      resource: 'tax_rule',
      resourceId: rule.id,
      details: { name: rule.name, priority: rule.priority },
    });

    return rule;
  }

  async findAll(organizationId: string) {
    return this.prisma.taxRule.findMany({
      where: { organizationId },
      include: {
        taxCode: { include: { rates: true } },
        jurisdiction: true,
        customer: true,
        supplier: true,
        customerGroup: true,
        itemCategory: true,
        item: true,
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const rule = await this.prisma.taxRule.findFirst({
      where: { id, organizationId },
      include: {
        taxCode: { include: { rates: true } },
        jurisdiction: true,
        customer: true,
        supplier: true,
        customerGroup: true,
        itemCategory: true,
        item: true,
      },
    });
    if (!rule) {
      throw new NotFoundException(`Tax rule ${id} not found.`);
    }
    return rule;
  }

  /**
   * Find matching tax rule evaluating priority and specific match criteria.
   */
  async findMatchingRule(organizationId: string, params: MatchTaxRuleParams) {
    const rules = await this.prisma.taxRule.findMany({
      where: {
        organizationId,
        isActive: true,
        OR: [
          { transactionType: TaxRuleTransactionType.BOTH },
          { transactionType: params.transactionType },
        ],
        AND: [
          {
            OR: [
              { effectiveFrom: null },
              { effectiveFrom: { lte: params.transactionDate } },
            ],
          },
          {
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: params.transactionDate } },
            ],
          },
        ],
      },
      include: {
        taxCode: { include: { rates: true } },
        jurisdiction: true,
      },
      orderBy: { priority: 'asc' },
    });

    // Check each candidate rule in priority order
    for (const r of rules) {
      if (r.customerId && r.customerId !== params.customerId) continue;
      if (r.supplierId && r.supplierId !== params.supplierId) continue;
      if (r.customerGroupId && r.customerGroupId !== params.customerGroupId)
        continue;
      if (r.itemId && r.itemId !== params.itemId) continue;
      if (r.itemCategoryId && r.itemCategoryId !== params.itemCategoryId)
        continue;
      if (r.jurisdictionId && r.jurisdictionId !== params.jurisdictionId)
        continue;

      return r;
    }

    return null;
  }

  async update(organizationId: string, id: string, dto: UpdateTaxRuleDto) {
    const existing = await this.findOne(organizationId, id);

    return this.prisma.taxRule.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.transactionType !== undefined
          ? { transactionType: dto.transactionType }
          : {}),
        ...(dto.taxCodeId !== undefined ? { taxCodeId: dto.taxCodeId } : {}),
        ...(dto.jurisdictionId !== undefined
          ? { jurisdictionId: dto.jurisdictionId }
          : {}),
        ...(dto.customerGroupId !== undefined
          ? { customerGroupId: dto.customerGroupId }
          : {}),
        ...(dto.customerId !== undefined ? { customerId: dto.customerId } : {}),
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.itemCategoryId !== undefined
          ? { itemCategoryId: dto.itemCategoryId }
          : {}),
        ...(dto.itemId !== undefined ? { itemId: dto.itemId } : {}),
        ...(dto.effectiveFrom !== undefined
          ? {
              effectiveFrom: dto.effectiveFrom
                ? new Date(dto.effectiveFrom)
                : null,
            }
          : {}),
        ...(dto.effectiveTo !== undefined
          ? {
              effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
            }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        taxCode: true,
        jurisdiction: true,
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    return this.prisma.taxRule.delete({
      where: { id: existing.id },
    });
  }
}
