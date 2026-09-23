import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateTaxPeriodDto } from './dto/create-tax-period.dto';
import { Prisma, TaxPeriodStatus, TaxScope } from '@prisma/client';

@Injectable()
export class TaxPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(organizationId: string, dto: CreateTaxPeriodDto) {
    const fromDate = new Date(dto.startDate);
    const toDate = new Date(dto.endDate);

    if (fromDate > toDate) {
      throw new BadRequestException('startDate must be earlier than endDate.');
    }

    const existing = await this.prisma.taxPeriod.findFirst({
      where: { organizationId, name: dto.name },
    });
    if (existing) {
      throw new BadRequestException(
        `Tax period with name "${dto.name}" already exists in this organization.`,
      );
    }

    return this.prisma.taxPeriod.create({
      data: {
        organizationId,
        name: dto.name,
        startDate: fromDate,
        endDate: toDate,
        status: TaxPeriodStatus.OPEN,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.taxPeriod.findMany({
      where: { organizationId },
      orderBy: { startDate: 'desc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const period = await this.prisma.taxPeriod.findFirst({
      where: { id, organizationId },
      include: {
        taxTransactions: {
          take: 20,
          orderBy: { transactionDate: 'desc' },
        },
      },
    });
    if (!period) {
      throw new NotFoundException(`Tax period ${id} not found.`);
    }
    return period;
  }

  /**
   * Prepare tax period summary from authoritative tax transactions.
   */
  async prepare(organizationId: string, id: string, actorUserId: string) {
    const period = await this.findOne(organizationId, id);

    if (period.status === TaxPeriodStatus.LOCKED) {
      throw new BadRequestException(
        `Cannot prepare locked tax period "${period.name}".`,
      );
    }

    // 1. Query output tax transactions
    const outputAgg = await this.prisma.taxTransaction.aggregate({
      where: {
        organizationId,
        taxScope: TaxScope.OUTPUT,
        transactionDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      _sum: {
        taxableAmount: true,
        taxAmount: true,
      },
    });

    // 2. Query input tax transactions
    const inputAgg = await this.prisma.taxTransaction.aggregate({
      where: {
        organizationId,
        taxScope: TaxScope.INPUT,
        transactionDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
      },
      _sum: {
        taxableAmount: true,
        taxAmount: true,
      },
    });

    const totalTaxableSales =
      outputAgg._sum.taxableAmount ?? new Prisma.Decimal(0);
    const totalOutputTax = outputAgg._sum.taxAmount ?? new Prisma.Decimal(0);
    const totalTaxablePurchases =
      inputAgg._sum.taxableAmount ?? new Prisma.Decimal(0);
    const totalInputTax = inputAgg._sum.taxAmount ?? new Prisma.Decimal(0);
    const netTaxPayable = totalOutputTax.sub(totalInputTax);

    // 3. Update tax period and link transactions
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.taxTransaction.updateMany({
        where: {
          organizationId,
          transactionDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
        },
        data: {
          taxPeriodId: period.id,
        },
      });

      return tx.taxPeriod.update({
        where: { id: period.id },
        data: {
          status: TaxPeriodStatus.PREPARED,
          totalTaxableSales,
          totalOutputTax,
          totalTaxablePurchases,
          totalInputTax,
          netTaxPayable,
          preparedAt: new Date(),
          preparedByUserId: actorUserId,
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'TAX_PERIOD_PREPARED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_period.prepared',
      resource: 'tax_period',
      resourceId: updated.id,
      details: {
        name: updated.name,
        totalOutputTax: totalOutputTax.toFixed(4),
        totalInputTax: totalInputTax.toFixed(4),
        netTaxPayable: netTaxPayable.toFixed(4),
      },
    });

    return updated;
  }

  /**
   * Lock tax period to finalize filing and disallow further transaction modifications.
   */
  async lock(organizationId: string, id: string, actorUserId: string) {
    const period = await this.findOne(organizationId, id);

    if (period.status === TaxPeriodStatus.LOCKED) {
      throw new BadRequestException(
        `Tax period "${period.name}" is already locked.`,
      );
    }

    const locked = await this.prisma.taxPeriod.update({
      where: { id: period.id },
      data: {
        status: TaxPeriodStatus.LOCKED,
        lockedAt: new Date(),
        lockedByUserId: actorUserId,
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_PERIOD_LOCKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_period.locked',
      resource: 'tax_period',
      resourceId: locked.id,
      details: {
        name: locked.name,
        netTaxPayable: locked.netTaxPayable.toFixed(4),
      },
    });

    return locked;
  }
}
