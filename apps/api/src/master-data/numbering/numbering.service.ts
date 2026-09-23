import {
  Injectable,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';
import { NumberingSequence } from '@prisma/client';

export interface GeneratedSequenceResult {
  sequenceKey: string;
  number: number;
  formatted: string;
}

@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * List all numbering sequences for an organization.
   */
  async findAll(
    organizationId: string,
    filter?: { isActive?: boolean },
  ): Promise<NumberingSequence[]> {
    const where: Record<string, unknown> = { organizationId };

    if (filter?.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    return this.prisma.numberingSequence.findMany({
      where,
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Find a single numbering sequence by ID within an organization.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<NumberingSequence> {
    const sequence = await this.prisma.numberingSequence.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!sequence) {
      throw new NotFoundException(
        `Numbering sequence with ID ${id} not found in organization`,
      );
    }

    return sequence;
  }

  /**
   * Create a new numbering sequence for an organization.
   */
  async create(
    organizationId: string,
    dto: CreateSequenceDto,
    actorUserId?: string,
  ): Promise<NumberingSequence> {
    const normalizedKey = dto.key.trim().toUpperCase();

    const existing = await this.prisma.numberingSequence.findFirst({
      where: {
        organizationId,
        key: normalizedKey,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Numbering sequence with key '${normalizedKey}' already exists in this organization`,
      );
    }

    const sequence = await this.prisma.numberingSequence.create({
      data: {
        organizationId,
        key: normalizedKey,
        prefix: dto.prefix?.trim() ?? null,
        nextNumber: BigInt(dto.nextNumber ?? 1),
        padding: dto.padding ?? 6,
        isActive: true,
      },
    });

    await this.eventBus.publish({
      eventName: 'NUMBERING_SEQUENCE_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'numbering.create',
      resource: 'numbering_sequence',
      resourceId: sequence.id,
      details: {
        key: sequence.key,
        prefix: sequence.prefix,
        padding: sequence.padding,
      },
    });

    return sequence;
  }

  /**
   * Update an existing numbering sequence.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateSequenceDto,
    actorUserId?: string,
  ): Promise<NumberingSequence> {
    const existing = await this.prisma.numberingSequence.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundException(
        `Numbering sequence with ID ${id} not found in organization`,
      );
    }

    const updated = await this.prisma.numberingSequence.update({
      where: { id },
      data: {
        prefix:
          dto.prefix !== undefined
            ? dto.prefix
              ? dto.prefix.trim()
              : null
            : undefined,
        nextNumber:
          dto.nextNumber !== undefined ? BigInt(dto.nextNumber) : undefined,
        padding: dto.padding !== undefined ? dto.padding : undefined,
        isActive: dto.isActive,
      },
    });

    await this.eventBus.publish({
      eventName: 'NUMBERING_SEQUENCE_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'numbering.update',
      resource: 'numbering_sequence',
      resourceId: updated.id,
      details: {
        key: updated.key,
        prefix: updated.prefix,
        padding: updated.padding,
      },
    });

    return updated;
  }

  /**
   * Atomically generate the next sequence number for a key under concurrent requests.
   * Uses PostgreSQL UPDATE ... RETURNING to prevent race conditions.
   */
  async nextNumber(
    organizationId: string,
    key: string,
    actorUserId?: string,
  ): Promise<GeneratedSequenceResult> {
    const normalizedKey = key.trim().toUpperCase();

    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        Array<{
          allocated_number: bigint | number | string;
          prefix: string | null;
          padding: number;
        }>
      >`
        UPDATE numbering_sequences
        SET next_number = next_number + 1, updated_at = NOW()
        WHERE organization_id = ${organizationId}::uuid
          AND key = ${normalizedKey}
          AND is_active = true
        RETURNING (next_number - 1) AS allocated_number, prefix, padding;
      `;

      if (!rows || rows.length === 0) {
        throw new NotFoundException(
          `Active numbering sequence '${normalizedKey}' not found in this organization`,
        );
      }

      const row = rows[0];
      const allocatedNum = Number(row.allocated_number);
      const prefix = row.prefix || '';
      const padded = String(allocatedNum).padStart(row.padding, '0');
      const formatted = `${prefix}${padded}`;

      return {
        sequenceKey: normalizedKey,
        number: allocatedNum,
        formatted,
      };
    });

    await this.eventBus.publish({
      eventName: 'NUMBERING_SEQUENCE_GENERATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: actorUserId ?? null,
      action: 'numbering.generate',
      resource: 'numbering_sequence',
      details: {
        key: result.sequenceKey,
        number: result.number,
        formatted: result.formatted,
      },
    });

    return result;
  }
}
