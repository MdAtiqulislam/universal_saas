import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateManufacturingConfigDto } from './dto/update-manufacturing-config.dto';

@Injectable()
export class ManufacturingConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create tenant manufacturing configuration.
   */
  async getConfig(organizationId: string) {
    let config = await this.prisma.manufacturingConfiguration.findUnique({
      where: { organizationId },
      include: {
        wipAccount: true,
        rawMaterialAccount: true,
        finishedGoodsAccount: true,
        laborAccount: true,
        overheadAccount: true,
        varianceAccount: true,
        defaultLocation: true,
      },
    });

    if (!config) {
      config = await this.prisma.manufacturingConfiguration.create({
        data: { organizationId },
        include: {
          wipAccount: true,
          rawMaterialAccount: true,
          finishedGoodsAccount: true,
          laborAccount: true,
          overheadAccount: true,
          varianceAccount: true,
          defaultLocation: true,
        },
      });
    }

    return config;
  }

  /**
   * Update tenant manufacturing configuration.
   */
  async updateConfig(
    organizationId: string,
    dto: UpdateManufacturingConfigDto,
  ) {
    // Validate accounts belong to this organization
    const accountIdsToCheck = [
      dto.wipAccountId,
      dto.rawMaterialAccountId,
      dto.finishedGoodsAccountId,
      dto.laborAccountId,
      dto.overheadAccountId,
      dto.varianceAccountId,
    ].filter((id): id is string => Boolean(id));

    if (accountIdsToCheck.length > 0) {
      const accounts = await this.prisma.account.findMany({
        where: {
          id: { in: accountIdsToCheck },
          organizationId,
        },
      });

      if (accounts.length !== accountIdsToCheck.length) {
        throw new BadRequestException(
          'One or more GL accounts do not belong to this organization or do not exist.',
        );
      }
    }

    if (dto.defaultLocationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.defaultLocationId, organizationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.defaultLocationId} not found in this organization.`,
        );
      }
    }

    return this.prisma.manufacturingConfiguration.upsert({
      where: { organizationId },
      create: {
        organizationId,
        wipAccountId: dto.wipAccountId,
        rawMaterialAccountId: dto.rawMaterialAccountId,
        finishedGoodsAccountId: dto.finishedGoodsAccountId,
        laborAccountId: dto.laborAccountId,
        overheadAccountId: dto.overheadAccountId,
        varianceAccountId: dto.varianceAccountId,
        allowReleaseOnShortage: dto.allowReleaseOnShortage ?? false,
        defaultLocationId: dto.defaultLocationId,
      },
      update: {
        wipAccountId: dto.wipAccountId,
        rawMaterialAccountId: dto.rawMaterialAccountId,
        finishedGoodsAccountId: dto.finishedGoodsAccountId,
        laborAccountId: dto.laborAccountId,
        overheadAccountId: dto.overheadAccountId,
        varianceAccountId: dto.varianceAccountId,
        allowReleaseOnShortage: dto.allowReleaseOnShortage,
        defaultLocationId: dto.defaultLocationId,
      },
      include: {
        wipAccount: true,
        rawMaterialAccount: true,
        finishedGoodsAccount: true,
        laborAccount: true,
        overheadAccount: true,
        varianceAccount: true,
        defaultLocation: true,
      },
    });
  }
}
