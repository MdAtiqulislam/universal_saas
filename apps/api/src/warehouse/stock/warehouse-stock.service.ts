import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WarehouseStockQueryDto } from './dto/stock-query.dto';
import {
  Prisma,
  WarehouseLocationType,
  ReservationStatus,
  QuarantineStatus,
} from '@prisma/client';

export interface WarehouseStockPosition {
  locationId: string;
  locationCode: string;
  locationName: string;
  locationType: string;
  itemId: string;
  itemSku: string;
  itemName: string;
  variantId: string | null;
  variantSku: string | null;
  onHand: string;
  reserved: string;
  available: string;
  quarantined: string;
  damaged: string;
  staged: string;
}

@Injectable()
export class WarehouseStockService {
  private readonly logger = new Logger(WarehouseStockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Derive operational stock positions for an organization.
   */
  async getStockPositions(
    organizationId: string,
    query: WarehouseStockQueryDto,
  ): Promise<{
    data: WarehouseStockPosition[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const balanceWhere: Prisma.InventoryBalanceWhereInput = {
      organizationId,
    };

    if (query.locationId) balanceWhere.locationId = query.locationId;
    if (query.itemId) balanceWhere.itemId = query.itemId;
    if (query.variantId) balanceWhere.variantId = query.variantId;

    if (query.warehouseId) {
      balanceWhere.location = {
        OR: [{ id: query.warehouseId }, { parentId: query.warehouseId }],
      };
    }

    if (query.search) {
      const search = query.search.trim();
      balanceWhere.OR = [
        { item: { sku: { contains: search, mode: 'insensitive' } } },
        { item: { name: { contains: search, mode: 'insensitive' } } },
        { location: { code: { contains: search, mode: 'insensitive' } } },
        { location: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [balances, total] = await Promise.all([
      this.prisma.inventoryBalance.findMany({
        where: balanceWhere,
        include: {
          location: true,
          item: true,
          variant: true,
        },
        orderBy: [{ location: { code: 'asc' } }, { item: { sku: 'asc' } }],
        skip,
        take: limit,
      }),
      this.prisma.inventoryBalance.count({ where: balanceWhere }),
    ]);

    if (balances.length === 0) {
      return { data: [], total: 0, page, limit };
    }

    // Fetch active reservations
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: {
        organizationId,
        status: ReservationStatus.ACTIVE,
        locationId: { in: balances.map((b) => b.locationId) },
        itemId: { in: balances.map((b) => b.itemId) },
      },
    });

    const reservedMap = new Map<string, Prisma.Decimal>();
    for (const res of reservations) {
      const key = `${res.locationId}_${res.itemId}_${res.variantId || 'null'}`;
      const current = reservedMap.get(key) || new Prisma.Decimal(0);
      reservedMap.set(key, current.plus(res.quantity));
    }

    // Fetch active quarantine records
    const quarantines = await this.prisma.quarantineRecord.findMany({
      where: {
        organizationId,
        status: {
          in: [
            QuarantineStatus.QUARANTINED,
            QuarantineStatus.UNDER_INSPECTION,
            QuarantineStatus.HELD,
          ],
        },
        locationId: { in: balances.map((b) => b.locationId) },
        itemId: { in: balances.map((b) => b.itemId) },
      },
    });

    const quarantineMap = new Map<string, Prisma.Decimal>();
    for (const q of quarantines) {
      const key = `${q.locationId}_${q.itemId}_${q.variantId || 'null'}`;
      const current = quarantineMap.get(key) || new Prisma.Decimal(0);
      quarantineMap.set(key, current.plus(q.quantity));
    }

    const data: WarehouseStockPosition[] = balances.map((b) => {
      const key = `${b.locationId}_${b.itemId}_${b.variantId || 'null'}`;
      const onHand = b.quantityOnHand;
      const reserved = reservedMap.get(key) || new Prisma.Decimal(0);
      const quarantined = quarantineMap.get(key) || new Prisma.Decimal(0);

      const locType = b.location.locationType || WarehouseLocationType.STORAGE;

      let damaged = new Prisma.Decimal(0);
      let staged = new Prisma.Decimal(0);
      let available = new Prisma.Decimal(0);

      if (
        locType === WarehouseLocationType.DAMAGED ||
        locType === WarehouseLocationType.SCRAP
      ) {
        damaged = onHand;
        available = new Prisma.Decimal(0);
      } else if (locType === WarehouseLocationType.STAGING) {
        staged = onHand;
        available = new Prisma.Decimal(0);
      } else if (locType === WarehouseLocationType.QUARANTINE) {
        available = new Prisma.Decimal(0);
      } else {
        // Normal storage / picking / receiving
        const unreservable = reserved.plus(quarantined);
        const calcAvailable = onHand.minus(unreservable);
        available = calcAvailable.gt(0) ? calcAvailable : new Prisma.Decimal(0);
      }

      return {
        locationId: b.locationId,
        locationCode: b.location.code,
        locationName: b.location.name,
        locationType: locType,
        itemId: b.itemId,
        itemSku: b.item.sku,
        itemName: b.item.name,
        variantId: b.variantId,
        variantSku: b.variant?.sku || null,
        onHand: onHand.toString(),
        reserved: reserved.toString(),
        available: available.toString(),
        quarantined: quarantined.toString(),
        damaged: damaged.toString(),
        staged: staged.toString(),
      };
    });

    return { data, total, page, limit };
  }
}
