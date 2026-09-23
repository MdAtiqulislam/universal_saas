import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCarrierDto } from './dto/create-carrier.dto';
import { UpdateCarrierDto } from './dto/update-carrier.dto';
import { CarrierQueryDto } from './dto/carrier-query.dto';
import { ShipmentCarrier, Prisma } from '@prisma/client';

@Injectable()
export class ShipmentCarriersService {
  private readonly logger = new Logger(ShipmentCarriersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new shipment carrier within the tenant organization.
   */
  async create(
    organizationId: string,
    dto: CreateCarrierDto,
    actorUserId?: string,
  ): Promise<ShipmentCarrier> {
    const normalizedCode = dto.code.trim().toUpperCase();

    // Check code uniqueness per tenant
    const existing = await this.prisma.shipmentCarrier.findFirst({
      where: {
        organizationId,
        code: normalizedCode,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Carrier with code '${normalizedCode}' already exists in this organization`,
      );
    }

    const carrier = await this.prisma.shipmentCarrier.create({
      data: {
        organizationId,
        code: normalizedCode,
        name: dto.name.trim(),
        carrierType: dto.carrierType ?? 'COURIER',
        contactName: dto.contactName?.trim() ?? null,
        phone: dto.phone?.trim() ?? null,
        email: dto.email?.trim() ?? null,
        address: dto.address?.trim() ?? null,
        trackingUrlTemplate: dto.trackingUrlTemplate?.trim() ?? null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CARRIER_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'carrier.create',
      resource: 'shipment_carrier',
      resourceId: carrier.id,
      details: {
        code: carrier.code,
        name: carrier.name,
        carrierType: carrier.carrierType,
      },
    });

    return carrier;
  }

  /**
   * Find paginated carriers with optional filtering.
   */
  async findAll(
    organizationId: string,
    query: CarrierQueryDto,
  ): Promise<{
    carriers: ShipmentCarrier[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ShipmentCarrierWhereInput = {
      organizationId,
    };

    if (query.carrierType) {
      where.carrierType = query.carrierType;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { contactName: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [carriers, total] = await Promise.all([
      this.prisma.shipmentCarrier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
      }),
      this.prisma.shipmentCarrier.count({ where }),
    ]);

    return {
      carriers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find a single carrier by ID within the tenant organization.
   */
  async findOne(organizationId: string, id: string): Promise<ShipmentCarrier> {
    const carrier = await this.prisma.shipmentCarrier.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        vehicles: true,
      },
    });

    if (!carrier) {
      throw new NotFoundException(`Carrier with ID ${id} not found`);
    }

    return carrier;
  }

  /**
   * Update an existing carrier.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateCarrierDto,
    actorUserId?: string,
  ): Promise<ShipmentCarrier> {
    const existing = await this.findOne(organizationId, id);

    let normalizedCode: string | undefined;
    if (dto.code && dto.code.trim().toUpperCase() !== existing.code) {
      normalizedCode = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.shipmentCarrier.findFirst({
        where: {
          organizationId,
          code: normalizedCode,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ConflictException(
          `Carrier with code '${normalizedCode}' already exists in this organization`,
        );
      }
    }

    const updated = await this.prisma.shipmentCarrier.update({
      where: { id },
      data: {
        code: normalizedCode ?? undefined,
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        carrierType: dto.carrierType,
        contactName:
          dto.contactName !== undefined
            ? (dto.contactName?.trim() ?? null)
            : undefined,
        phone:
          dto.phone !== undefined ? (dto.phone?.trim() ?? null) : undefined,
        email:
          dto.email !== undefined ? (dto.email?.trim() ?? null) : undefined,
        address:
          dto.address !== undefined ? (dto.address?.trim() ?? null) : undefined,
        trackingUrlTemplate:
          dto.trackingUrlTemplate !== undefined
            ? (dto.trackingUrlTemplate?.trim() ?? null)
            : undefined,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'CARRIER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'carrier.update',
      resource: 'shipment_carrier',
      resourceId: updated.id,
      details: {
        code: updated.code,
        name: updated.name,
      },
    });

    return updated;
  }

  /**
   * Activate a carrier.
   */
  async activate(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ShipmentCarrier> {
    const existing = await this.findOne(organizationId, id);
    if (existing.isActive) {
      return existing;
    }

    const updated = await this.prisma.shipmentCarrier.update({
      where: { id },
      data: { isActive: true },
    });

    await this.eventBus.publish({
      eventName: 'CARRIER_ACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'carrier.activate',
      resource: 'shipment_carrier',
      resourceId: updated.id,
      details: { code: updated.code },
    });

    return updated;
  }

  /**
   * Deactivate a carrier.
   */
  async deactivate(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<ShipmentCarrier> {
    const existing = await this.findOne(organizationId, id);
    if (!existing.isActive) {
      return existing;
    }

    const updated = await this.prisma.shipmentCarrier.update({
      where: { id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventName: 'CARRIER_DEACTIVATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'carrier.deactivate',
      resource: 'shipment_carrier',
      resourceId: updated.id,
      details: { code: updated.code },
    });

    return updated;
  }

  /**
   * Delete a carrier if not referenced by any shipments.
   */
  async delete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.findOne(organizationId, id);

    const referencedCount = await this.prisma.shipment.count({
      where: {
        organizationId,
        carrierId: id,
      },
    });

    if (referencedCount > 0) {
      throw new BadRequestException(
        `Cannot delete carrier because it is referenced by ${referencedCount} shipment(s). Deactivate it instead.`,
      );
    }

    await this.prisma.shipmentCarrier.delete({
      where: { id },
    });

    await this.eventBus.publish({
      eventName: 'CARRIER_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'carrier.delete',
      resource: 'shipment_carrier',
      resourceId: id,
      details: { action: 'deleted' },
    });

    return { success: true, message: 'Carrier deleted successfully' };
  }
}
