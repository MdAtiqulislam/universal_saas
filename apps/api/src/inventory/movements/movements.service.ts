import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MovementQueryDto } from './dto/movement-query.dto';
import { StockMovement } from '@prisma/client';

export interface PaginatedMovementsResult {
  movements: StockMovement[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class MovementsService {
  private readonly logger = new Logger(MovementsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query immutable stock movements ledger with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: MovementQueryDto,
  ): Promise<PaginatedMovementsResult> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { organizationId };

    if (query.itemId) {
      where.itemId = query.itemId;
    }

    if (query.locationId) {
      where.locationId = query.locationId;
    }

    if (query.movementType) {
      where.movementType = query.movementType;
    }

    if (query.batchId) {
      where.batchId = query.batchId;
    }

    if (query.serialId) {
      where.serialId = query.serialId;
    }

    if (query.startDate || query.endDate) {
      const createdAt: Record<string, Date> = {};
      if (query.startDate) {
        createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        createdAt.lte = new Date(query.endDate);
      }
      where.createdAt = createdAt;
    }

    const [total, movements] = await Promise.all([
      this.prisma.stockMovement.count({ where }),
      this.prisma.stockMovement.findMany({
        where,
        include: {
          item: {
            select: { id: true, sku: true, name: true, itemType: true },
          },
          variant: {
            select: { id: true, sku: true, name: true },
          },
          location: {
            select: { id: true, code: true, name: true },
          },
          batch: {
            select: { id: true, batchNumber: true, expiresAt: true },
          },
          serial: {
            select: { id: true, serialNumber: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      movements,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find single movement by ID.
   */
  async findOne(organizationId: string, id: string): Promise<StockMovement> {
    const movement = await this.prisma.stockMovement.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        item: {
          select: { id: true, sku: true, name: true },
        },
        variant: {
          select: { id: true, sku: true, name: true },
        },
        location: {
          select: { id: true, code: true, name: true },
        },
        batch: {
          select: { id: true, batchNumber: true, expiresAt: true },
        },
        serial: {
          select: { id: true, serialNumber: true, status: true },
        },
      },
    });

    if (!movement) {
      throw new NotFoundException(
        `Stock movement with ID ${id} not found in organization`,
      );
    }

    return movement;
  }
}
