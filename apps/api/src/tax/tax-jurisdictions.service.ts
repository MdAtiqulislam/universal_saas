import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaxJurisdictionDto } from './dto/create-tax-jurisdiction.dto';
import { UpdateTaxJurisdictionDto } from './dto/update-tax-jurisdiction.dto';

@Injectable()
export class TaxJurisdictionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreateTaxJurisdictionDto) {
    const existing = await this.prisma.taxJurisdiction.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new BadRequestException(
        `Tax jurisdiction with code "${dto.code}" already exists in this organization.`,
      );
    }

    if (dto.parentJurisdictionId) {
      const parent = await this.prisma.taxJurisdiction.findFirst({
        where: { id: dto.parentJurisdictionId, organizationId },
      });
      if (!parent) {
        throw new NotFoundException('Parent jurisdiction not found.');
      }
    }

    return this.prisma.taxJurisdiction.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        countryCode: dto.countryCode,
        type: dto.type,
        parentJurisdictionId: dto.parentJurisdictionId,
        isActive: dto.isActive ?? true,
      },
      include: {
        parentJurisdiction: true,
        childJurisdictions: true,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.taxJurisdiction.findMany({
      where: { organizationId },
      include: {
        parentJurisdiction: true,
        childJurisdictions: true,
        taxCodes: true,
      },
      orderBy: [{ countryCode: 'asc' }, { code: 'asc' }],
    });
  }

  async findOne(organizationId: string, id: string) {
    const jurisdiction = await this.prisma.taxJurisdiction.findFirst({
      where: { id, organizationId },
      include: {
        parentJurisdiction: true,
        childJurisdictions: true,
        taxCodes: true,
      },
    });
    if (!jurisdiction) {
      throw new NotFoundException(`Tax jurisdiction ${id} not found.`);
    }
    return jurisdiction;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateTaxJurisdictionDto,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.parentJurisdictionId) {
      if (dto.parentJurisdictionId === id) {
        throw new BadRequestException(
          'Jurisdiction cannot be its own parent (circular reference).',
        );
      }
      const parent = await this.prisma.taxJurisdiction.findFirst({
        where: { id: dto.parentJurisdictionId, organizationId },
      });
      if (!parent) {
        throw new NotFoundException('Parent jurisdiction not found.');
      }
    }

    return this.prisma.taxJurisdiction.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.countryCode !== undefined
          ? { countryCode: dto.countryCode }
          : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.parentJurisdictionId !== undefined
          ? { parentJurisdictionId: dto.parentJurisdictionId }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        parentJurisdiction: true,
        childJurisdictions: true,
      },
    });
  }
}
