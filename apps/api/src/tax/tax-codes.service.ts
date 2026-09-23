import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateTaxCodeDto } from './dto/create-tax-code.dto';
import { UpdateTaxCodeDto } from './dto/update-tax-code.dto';

@Injectable()
export class TaxCodesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateTaxCodeDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.taxCode.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Tax code "${dto.code}" already exists in this organization.`,
      );
    }

    if (dto.jurisdictionId) {
      const jurisdiction = await this.prisma.taxJurisdiction.findFirst({
        where: { id: dto.jurisdictionId, organizationId },
      });
      if (!jurisdiction) {
        throw new NotFoundException('Specified tax jurisdiction not found.');
      }
    }

    const taxCode = await this.prisma.taxCode.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        taxType: dto.taxType,
        taxScope: dto.taxScope,
        jurisdictionId: dto.jurisdictionId,
        isExempt: dto.isExempt ?? false,
        isZeroRated: dto.isZeroRated ?? false,
        isSystem: dto.isSystem ?? false,
        isActive: dto.isActive ?? true,
      },
      include: {
        jurisdiction: true,
        rates: { orderBy: { effectiveFrom: 'desc' } },
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_CODE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_code.created',
      resource: 'tax_code',
      resourceId: taxCode.id,
      details: { code: taxCode.code, name: taxCode.name },
    });

    return taxCode;
  }

  async findAll(organizationId: string) {
    return this.prisma.taxCode.findMany({
      where: { organizationId },
      include: {
        jurisdiction: true,
        rates: { orderBy: { effectiveFrom: 'desc' } },
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const taxCode = await this.prisma.taxCode.findFirst({
      where: { id, organizationId },
      include: {
        jurisdiction: true,
        rates: { orderBy: { effectiveFrom: 'desc' } },
      },
    });
    if (!taxCode) {
      throw new NotFoundException(`Tax code ${id} not found.`);
    }
    return taxCode;
  }

  async findByCode(organizationId: string, code: string) {
    return this.prisma.taxCode.findFirst({
      where: { organizationId, code },
      include: {
        jurisdiction: true,
        rates: { orderBy: { effectiveFrom: 'desc' } },
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTaxCodeDto,
    actorUserId?: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.jurisdictionId) {
      const jurisdiction = await this.prisma.taxJurisdiction.findFirst({
        where: { id: dto.jurisdictionId, organizationId },
      });
      if (!jurisdiction) {
        throw new NotFoundException('Specified tax jurisdiction not found.');
      }
    }

    const updated = await this.prisma.taxCode.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.taxType !== undefined ? { taxType: dto.taxType } : {}),
        ...(dto.taxScope !== undefined ? { taxScope: dto.taxScope } : {}),
        ...(dto.jurisdictionId !== undefined
          ? { jurisdictionId: dto.jurisdictionId }
          : {}),
        ...(dto.isExempt !== undefined ? { isExempt: dto.isExempt } : {}),
        ...(dto.isZeroRated !== undefined
          ? { isZeroRated: dto.isZeroRated }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        jurisdiction: true,
        rates: { orderBy: { effectiveFrom: 'desc' } },
      },
    });

    await this.eventBus.publish({
      eventName: 'TAX_CODE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax_code.updated',
      resource: 'tax_code',
      resourceId: updated.id,
      details: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.findOne(organizationId, id);
    if (existing.isSystem) {
      throw new BadRequestException('System tax codes cannot be deleted.');
    }
    return this.prisma.taxCode.delete({
      where: { id: existing.id },
    });
  }
}
