import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateEffectiveTaxRateDto } from './dto/create-effective-tax-rate.dto';
import { UpdateEffectiveTaxRateDto } from './dto/update-effective-tax-rate.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TaxRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateEffectiveTaxRateDto,
    actorUserId?: string,
  ) {
    const taxCode = await this.prisma.taxCode.findFirst({
      where: { id: dto.taxCodeId, organizationId },
    });
    if (!taxCode) {
      throw new NotFoundException('Tax code not found in this organization.');
    }

    const fromDate = new Date(dto.effectiveFrom);
    const toDate = dto.effectiveTo ? new Date(dto.effectiveTo) : null;

    if (toDate && fromDate > toDate) {
      throw new BadRequestException(
        'effectiveFrom date must be earlier than or equal to effectiveTo date.',
      );
    }

    // Check overlapping periods for this tax code
    const existingRates = await this.prisma.effectiveTaxRate.findMany({
      where: { organizationId, taxCodeId: dto.taxCodeId },
    });

    for (const r of existingRates) {
      const rFrom = r.effectiveFrom;
      const rTo = r.effectiveTo;

      const overlaps =
        (!toDate || rFrom <= toDate) && (!rTo || fromDate <= rTo);

      if (overlaps) {
        throw new BadRequestException(
          `Effective rate period overlaps with existing rate from ${rFrom.toISOString().slice(0, 10)} to ${rTo ? rTo.toISOString().slice(0, 10) : 'indefinite'}.`,
        );
      }
    }

    const rate = await this.prisma.effectiveTaxRate.create({
      data: {
        organizationId,
        taxCodeId: dto.taxCodeId,
        rate: new Prisma.Decimal(dto.rate),
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        isInclusive: dto.isInclusive ?? false,
        description: dto.description,
      },
      include: { taxCode: true },
    });

    await this.eventBus.publish({
      eventName: 'TAX_RATE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_rate.created',
      resource: 'effective_tax_rate',
      resourceId: rate.id,
      details: {
        taxCodeId: dto.taxCodeId,
        rate: dto.rate.toString(),
        effectiveFrom: dto.effectiveFrom,
      },
    });

    return rate;
  }

  async findAll(organizationId: string, taxCodeId?: string) {
    return this.prisma.effectiveTaxRate.findMany({
      where: {
        organizationId,
        ...(taxCodeId ? { taxCodeId } : {}),
      },
      include: { taxCode: true },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const rate = await this.prisma.effectiveTaxRate.findFirst({
      where: { id, organizationId },
      include: { taxCode: true },
    });
    if (!rate) {
      throw new NotFoundException(`Effective tax rate ${id} not found.`);
    }
    return rate;
  }

  /**
   * Find the effective rate active on a specific date for a tax code.
   */
  async findEffectiveRate(
    organizationId: string,
    taxCodeId: string,
    targetDate: Date,
  ) {
    return this.prisma.effectiveTaxRate.findFirst({
      where: {
        organizationId,
        taxCodeId,
        effectiveFrom: { lte: targetDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: targetDate } }],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateEffectiveTaxRateDto,
  ) {
    const existing = await this.findOne(organizationId, id);

    const fromDate = dto.effectiveFrom
      ? new Date(dto.effectiveFrom)
      : existing.effectiveFrom;
    const toDate =
      dto.effectiveTo !== undefined
        ? dto.effectiveTo
          ? new Date(dto.effectiveTo)
          : null
        : existing.effectiveTo;

    if (toDate && fromDate > toDate) {
      throw new BadRequestException(
        'effectiveFrom date must be earlier than or equal to effectiveTo date.',
      );
    }

    return this.prisma.effectiveTaxRate.update({
      where: { id: existing.id },
      data: {
        ...(dto.rate !== undefined
          ? { rate: new Prisma.Decimal(dto.rate) }
          : {}),
        ...(dto.effectiveFrom !== undefined ? { effectiveFrom: fromDate } : {}),
        ...(dto.effectiveTo !== undefined ? { effectiveTo: toDate } : {}),
        ...(dto.isInclusive !== undefined
          ? { isInclusive: dto.isInclusive }
          : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
      },
      include: { taxCode: true },
    });
  }
}
