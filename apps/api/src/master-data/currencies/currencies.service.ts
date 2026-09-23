import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';
import { Currency } from '@prisma/client';

@Injectable()
export class CurrenciesService {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all global currencies with optional filtering.
   */
  async findAll(filter?: {
    isActive?: boolean;
    search?: string;
  }): Promise<Currency[]> {
    const where: Record<string, unknown> = {};

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter?.search) {
      const searchTerm = filter.search.trim();
      where.OR = [
        { code: { contains: searchTerm, mode: 'insensitive' } },
        { name: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    return this.prisma.currency.findMany({
      where,
      orderBy: { code: 'asc' },
    });
  }

  /**
   * Get single currency by ID.
   */
  async findOne(id: string): Promise<Currency> {
    const currency = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!currency) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    return currency;
  }

  /**
   * Create new global currency reference data.
   */
  async create(
    dto: CreateCurrencyDto,
    actorUserId?: string,
  ): Promise<Currency> {
    const normalizedCode = dto.code.trim().toUpperCase();

    const existing = await this.prisma.currency.findUnique({
      where: { code: normalizedCode },
    });

    if (existing) {
      throw new ConflictException(
        `Currency code '${normalizedCode}' already exists`,
      );
    }

    const currency = await this.prisma.currency.create({
      data: {
        code: normalizedCode,
        name: dto.name.trim(),
        symbol: dto.symbol?.trim() ?? null,
        decimalPlaces: dto.decimalPlaces ?? 2,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'CURRENCY_CREATED',
      occurredAt: new Date(),
      actorUserId: actorUserId ?? null,
      currencyId: currency.id,
      code: currency.code,
      name: currency.name,
    });

    return currency;
  }

  /**
   * Update currency attributes.
   */
  async update(
    id: string,
    dto: UpdateCurrencyDto,
    actorUserId?: string,
  ): Promise<Currency> {
    const existing = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    const updated = await this.prisma.currency.update({
      where: { id },
      data: {
        name: dto.name !== undefined ? dto.name.trim() : undefined,
        symbol:
          dto.symbol !== undefined
            ? dto.symbol
              ? dto.symbol.trim()
              : null
            : undefined,
        decimalPlaces: dto.decimalPlaces,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'CURRENCY_UPDATED',
      occurredAt: new Date(),
      actorUserId: actorUserId ?? null,
      currencyId: updated.id,
      code: updated.code,
    });

    return updated;
  }

  /**
   * Deactivate a global currency (safe alternative to deletion).
   */
  async deactivate(
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.currency.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Currency with ID ${id} not found`);
    }

    await this.prisma.currency.update({
      where: { id },
      data: { isActive: false },
    });

    await this.eventBus.publish({
      eventName: 'CURRENCY_DEACTIVATED',
      occurredAt: new Date(),
      actorUserId: actorUserId ?? null,
      currencyId: existing.id,
      code: existing.code,
    });

    return {
      success: true,
      message: `Currency '${existing.code}' deactivated successfully`,
    };
  }
}
