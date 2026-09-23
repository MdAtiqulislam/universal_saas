import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { TrackingType, StockMovementType, SerialStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { BalancesService } from '../balances/balances.service';
import { CreateSerialDto } from './dto/create-serial.dto';
import { UpdateSerialDto } from './dto/update-serial.dto';
import { InventorySerial } from '@prisma/client';

@Injectable()
export class SerialsService {
  private readonly logger = new Logger(SerialsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly balancesService: BalancesService,
  ) {}

  /**
   * List all serialized items in an organization with filters.
   */
  async findAll(
    organizationId: string,
    filter?: {
      itemId?: string;
      locationId?: string;
      status?: SerialStatus;
      search?: string;
    },
  ): Promise<InventorySerial[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.itemId) {
      where.itemId = filter.itemId;
    }

    if (filter?.locationId) {
      where.locationId = filter.locationId;
    }

    if (filter?.status) {
      where.status = filter.status;
    }

    if (filter?.search) {
      where.serialNumber = {
        contains: filter.search.trim().toUpperCase(),
        mode: 'insensitive',
      };
    }

    return this.prisma.inventorySerial.findMany({
      where,
      include: {
        item: {
          select: { id: true, sku: true, name: true, trackingType: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find single serial by ID.
   */
  async findOne(organizationId: string, id: string): Promise<InventorySerial> {
    const serial = await this.prisma.inventorySerial.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true, trackingType: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
      },
    });

    if (!serial) {
      throw new NotFoundException(
        `Serial with ID ${id} not found in organization`,
      );
    }

    return serial;
  }

  /**
   * Register a new serial number.
   */
  async create(
    organizationId: string,
    dto: CreateSerialDto,
    actorUserId?: string,
  ): Promise<InventorySerial> {
    const normalizedSerial = dto.serialNumber.trim().toUpperCase();

    // 1. Verify Item is SERIAL tracked
    const item = await this.prisma.item.findFirst({
      where: {
        id: dto.itemId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!item) {
      throw new NotFoundException(
        `Item with ID ${dto.itemId} not found in organization`,
      );
    }

    if (item.trackingType !== TrackingType.SERIAL) {
      throw new BadRequestException(
        `Item '${item.sku}' trackingType is ${item.trackingType}, but SERIAL tracking is required`,
      );
    }

    // 2. Verify Location
    const location = await this.prisma.location.findFirst({
      where: {
        id: dto.locationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!location) {
      throw new NotFoundException(
        `Location with ID ${dto.locationId} not found in organization`,
      );
    }

    // 3. Verify Variant if specified
    if (dto.variantId) {
      const variant = await this.prisma.itemVariant.findFirst({
        where: {
          id: dto.variantId,
          itemId: dto.itemId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!variant) {
        throw new NotFoundException(
          `Variant with ID ${dto.variantId} not found for item in organization`,
        );
      }
    }

    // 4. Check uniqueness in organization
    const existing = await this.prisma.inventorySerial.findFirst({
      where: {
        organizationId,
        serialNumber: normalizedSerial,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Serial number '${normalizedSerial}' already exists in this organization`,
      );
    }

    const serial = await this.prisma.inventorySerial.create({
      data: {
        organizationId,
        itemId: dto.itemId,
        variantId: dto.variantId ?? null,
        locationId: dto.locationId,
        serialNumber: normalizedSerial,
        status: SerialStatus.AVAILABLE,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERIAL_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'serial.create',
      resource: 'inventory_serial',
      resourceId: serial.id,
      details: {
        serialNumber: serial.serialNumber,
        itemId: serial.itemId,
        locationId: serial.locationId,
      },
    });

    // Auto-receive initial stock of 1 unit
    if (dto.autoReceive) {
      await this.balancesService.applyStockMovement(
        organizationId,
        {
          itemId: dto.itemId,
          variantId: dto.variantId,
          locationId: dto.locationId,
          movementType: StockMovementType.RECEIPT,
          quantity: 1,
          serialId: serial.id,
          reason: 'Initial serial registration',
          referenceType: 'SERIAL_INITIALIZATION',
        },
        actorUserId,
      );

      return this.findOne(organizationId, serial.id);
    }

    return serial;
  }

  /**
   * Update serial status.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSerialDto,
    actorUserId?: string,
  ): Promise<InventorySerial> {
    const existing = await this.prisma.inventorySerial.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Serial with ID ${id} not found in organization`,
      );
    }

    const updated = await this.prisma.inventorySerial.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });

    await this.eventBus.publish({
      eventName: 'SERIAL_STATUS_CHANGED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'serial.status_change',
      resource: 'inventory_serial',
      resourceId: updated.id,
      details: {
        serialNumber: updated.serialNumber,
        oldStatus: existing.status,
        newStatus: updated.status,
      },
    });

    return updated;
  }
}
