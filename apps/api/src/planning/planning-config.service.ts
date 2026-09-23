import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { UpdatePlanningConfigDto } from './dto/update-planning-config.dto';
import { CreateItemPlanningProfileDto } from './dto/create-item-planning-profile.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PlanningConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Get or initialize tenant planning configuration.
   */
  async getConfig(organizationId: string) {
    let config = await this.prisma.planningConfiguration.findUnique({
      where: { organizationId },
      include: { defaultLocation: true },
    });

    if (!config) {
      config = await this.prisma.planningConfiguration.create({
        data: {
          organizationId,
          defaultPlanningHorizonDays: 30,
          defaultLeadTimeDays: 7,
          defaultSafetyStock: new Prisma.Decimal(0),
          includeSalesOrders: true,
          includeProductionOrders: true,
          includeSafetyStock: true,
        },
        include: { defaultLocation: true },
      });
    }

    return config;
  }

  /**
   * Update tenant planning configuration.
   */
  async updateConfig(
    organizationId: string,
    dto: UpdatePlanningConfigDto,
    userId: string,
  ) {
    if (dto.defaultLocationId) {
      const location = await this.prisma.location.findFirst({
        where: { id: dto.defaultLocationId, organizationId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with ID ${dto.defaultLocationId} not found in organization.`,
        );
      }
    }

    const current = await this.getConfig(organizationId);

    const updated = await this.prisma.planningConfiguration.update({
      where: { id: current.id },
      data: {
        defaultPlanningHorizonDays: dto.defaultPlanningHorizonDays,
        defaultLeadTimeDays: dto.defaultLeadTimeDays,
        defaultSafetyStock:
          dto.defaultSafetyStock !== undefined
            ? new Prisma.Decimal(dto.defaultSafetyStock)
            : undefined,
        includeSalesOrders: dto.includeSalesOrders,
        includeProductionOrders: dto.includeProductionOrders,
        includeSafetyStock: dto.includeSafetyStock,
        defaultLocationId:
          dto.defaultLocationId !== undefined
            ? dto.defaultLocationId
            : undefined,
      },
      include: { defaultLocation: true },
    });

    await this.eventBus.publish({
      eventName: 'MRP_CONFIGURATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'planning.configuration.update',
      resource: 'planning_configuration',
      resourceId: updated.id,
      details: {
        defaultPlanningHorizonDays: updated.defaultPlanningHorizonDays,
        defaultLeadTimeDays: updated.defaultLeadTimeDays,
      },
    });

    return updated;
  }

  /**
   * Upsert item planning profile.
   */
  async upsertItemProfile(
    organizationId: string,
    dto: CreateItemPlanningProfileDto,
    userId: string,
  ) {
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(
        `Item with ID ${dto.itemId} not found in organization.`,
      );
    }

    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: { id: dto.variantId, itemId: dto.itemId, organizationId },
      });
      if (!variant) {
        throw new NotFoundException(
          `ItemVariant with ID ${dto.variantId} not found for item ${dto.itemId}.`,
        );
      }
    }

    if (dto.preferredSupplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: dto.preferredSupplierId, organizationId },
      });
      if (!supplier) {
        throw new NotFoundException(
          `Supplier with ID ${dto.preferredSupplierId} not found in organization.`,
        );
      }
    }

    if (dto.preferredBomId) {
      const bom = await this.prisma.billOfMaterial.findFirst({
        where: { id: dto.preferredBomId, itemId: dto.itemId, organizationId },
      });
      if (!bom) {
        throw new NotFoundException(
          `BOM with ID ${dto.preferredBomId} not found for item ${dto.itemId}.`,
        );
      }
    }

    const existing = await this.prisma.itemPlanningProfile.findFirst({
      where: {
        organizationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
      },
    });

    let profile;
    if (existing) {
      profile = await this.prisma.itemPlanningProfile.update({
        where: { id: existing.id },
        data: {
          leadTimeDays: dto.leadTimeDays,
          safetyStock:
            dto.safetyStock !== undefined
              ? new Prisma.Decimal(dto.safetyStock)
              : undefined,
          reorderPoint:
            dto.reorderPoint !== undefined
              ? new Prisma.Decimal(dto.reorderPoint)
              : undefined,
          minOrderQuantity:
            dto.minOrderQuantity !== undefined
              ? new Prisma.Decimal(dto.minOrderQuantity)
              : undefined,
          maxOrderQuantity:
            dto.maxOrderQuantity !== undefined
              ? new Prisma.Decimal(dto.maxOrderQuantity)
              : undefined,
          orderMultiple:
            dto.orderMultiple !== undefined
              ? new Prisma.Decimal(dto.orderMultiple)
              : undefined,
          preferredSupplierId: dto.preferredSupplierId,
          preferredBomId: dto.preferredBomId,
        },
        include: {
          item: true,
          variant: true,
          preferredSupplier: true,
          preferredBom: true,
        },
      });
    } else {
      profile = await this.prisma.itemPlanningProfile.create({
        data: {
          organizationId,
          itemId: dto.itemId,
          variantId: dto.variantId,
          leadTimeDays: dto.leadTimeDays ?? 7,
          safetyStock: new Prisma.Decimal(dto.safetyStock ?? 0),
          reorderPoint: new Prisma.Decimal(dto.reorderPoint ?? 0),
          minOrderQuantity: new Prisma.Decimal(dto.minOrderQuantity ?? 1),
          maxOrderQuantity: dto.maxOrderQuantity
            ? new Prisma.Decimal(dto.maxOrderQuantity)
            : null,
          orderMultiple: new Prisma.Decimal(dto.orderMultiple ?? 1),
          preferredSupplierId: dto.preferredSupplierId,
          preferredBomId: dto.preferredBomId,
        },
        include: {
          item: true,
          variant: true,
          preferredSupplier: true,
          preferredBom: true,
        },
      });
    }

    await this.eventBus.publish({
      eventName: 'MRP_CONFIGURATION_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId,
      action: 'planning.profile.upsert',
      resource: 'item_planning_profile',
      resourceId: profile.id,
      details: {
        itemId: profile.itemId,
        variantId: profile.variantId,
      },
    });

    return profile;
  }

  /**
   * Get item planning profile or fallback to defaults.
   */
  async getItemProfile(
    organizationId: string,
    itemId: string,
    variantId?: string,
  ) {
    const profile = await this.prisma.itemPlanningProfile.findFirst({
      where: {
        organizationId,
        itemId,
        variantId: variantId ?? null,
      },
      include: { preferredSupplier: true, preferredBom: true },
    });

    if (profile) {
      return profile;
    }

    const config = await this.getConfig(organizationId);
    return {
      organizationId,
      itemId,
      variantId: variantId ?? null,
      leadTimeDays: config.defaultLeadTimeDays,
      safetyStock: config.defaultSafetyStock,
      reorderPoint: new Prisma.Decimal(0),
      minOrderQuantity: new Prisma.Decimal(1),
      maxOrderQuantity: null,
      orderMultiple: new Prisma.Decimal(1),
      preferredSupplierId: null,
      preferredBomId: null,
      preferredSupplier: null,
      preferredBom: null,
    };
  }

  /**
   * List all item planning profiles for tenant.
   */
  async listItemProfiles(organizationId: string) {
    return this.prisma.itemPlanningProfile.findMany({
      where: { organizationId },
      include: {
        item: true,
        variant: true,
        preferredSupplier: true,
        preferredBom: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Delete item planning profile.
   */
  async deleteItemProfile(organizationId: string, id: string) {
    const profile = await this.prisma.itemPlanningProfile.findFirst({
      where: { id, organizationId },
    });
    if (!profile) {
      throw new NotFoundException(
        `Item planning profile with ID ${id} not found.`,
      );
    }

    return this.prisma.itemPlanningProfile.delete({
      where: { id },
    });
  }
}
