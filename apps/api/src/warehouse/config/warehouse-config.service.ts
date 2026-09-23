import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { UpdateWarehouseConfigDto } from './dto/update-warehouse-config.dto';
import { WarehouseConfiguration } from '@prisma/client';

export type WarehouseConfigWithLocations = WarehouseConfiguration & {
  defaultReceivingLocation: { id: string; code: string; name: string } | null;
  defaultStagingLocation: { id: string; code: string; name: string } | null;
  defaultQuarantineLocation: { id: string; code: string; name: string } | null;
  defaultScrapLocation: { id: string; code: string; name: string } | null;
  defaultReturnLocation: { id: string; code: string; name: string } | null;
  defaultPickLocation: { id: string; code: string; name: string } | null;
};

@Injectable()
export class WarehouseConfigService {
  private readonly logger = new Logger(WarehouseConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Get organization warehouse configuration, creating if not present.
   */
  async getConfig(
    organizationId: string,
  ): Promise<WarehouseConfigWithLocations> {
    let config = await this.prisma.warehouseConfiguration.findUnique({
      where: { organizationId },
      include: {
        defaultReceivingLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultStagingLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultQuarantineLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultScrapLocation: { select: { id: true, code: true, name: true } },
        defaultReturnLocation: { select: { id: true, code: true, name: true } },
        defaultPickLocation: { select: { id: true, code: true, name: true } },
      },
    });

    if (!config) {
      config = await this.prisma.warehouseConfiguration.create({
        data: { organizationId },
        include: {
          defaultReceivingLocation: {
            select: { id: true, code: true, name: true },
          },
          defaultStagingLocation: {
            select: { id: true, code: true, name: true },
          },
          defaultQuarantineLocation: {
            select: { id: true, code: true, name: true },
          },
          defaultScrapLocation: {
            select: { id: true, code: true, name: true },
          },
          defaultReturnLocation: {
            select: { id: true, code: true, name: true },
          },
          defaultPickLocation: { select: { id: true, code: true, name: true } },
        },
      });
    }

    return config;
  }

  /**
   * Update warehouse configuration.
   */
  async updateConfig(
    organizationId: string,
    dto: UpdateWarehouseConfigDto,
    actorUserId?: string,
  ): Promise<WarehouseConfigWithLocations> {
    await this.getConfig(organizationId);

    const updated = await this.prisma.warehouseConfiguration.update({
      where: { organizationId },
      data: {
        defaultReceivingLocationId: dto.defaultReceivingLocationId ?? undefined,
        defaultStagingLocationId: dto.defaultStagingLocationId ?? undefined,
        defaultQuarantineLocationId:
          dto.defaultQuarantineLocationId ?? undefined,
        defaultScrapLocationId: dto.defaultScrapLocationId ?? undefined,
        defaultReturnLocationId: dto.defaultReturnLocationId ?? undefined,
        defaultPickLocationId: dto.defaultPickLocationId ?? undefined,
      },
      include: {
        defaultReceivingLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultStagingLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultQuarantineLocation: {
          select: { id: true, code: true, name: true },
        },
        defaultScrapLocation: { select: { id: true, code: true, name: true } },
        defaultReturnLocation: { select: { id: true, code: true, name: true } },
        defaultPickLocation: { select: { id: true, code: true, name: true } },
      },
    });

    await this.eventBus.publish({
      eventName: 'WAREHOUSE_CONFIGURATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'warehouse.config_update',
      resource: 'warehouse_configuration',
      resourceId: updated.id,
      details: { organizationId },
    });

    return updated;
  }
}
