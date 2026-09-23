import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { AccountQueryDto } from './dto/account-query.dto';
import { Account, Prisma } from '@prisma/client';

export type AccountWithDetails = Prisma.AccountGetPayload<{
  include: {
    parent: { select: { id: true; code: true; name: true; type: true } };
    children: {
      select: { id: true; code: true; name: true; type: true; isActive: true };
    };
    _count: { select: { journalLines: true; children: true } };
  };
}>;

@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Helper: Check for circular parent-child reference in account hierarchy.
   */
  private async validateNoCircularReference(
    organizationId: string,
    accountId: string,
    targetParentId: string,
  ): Promise<void> {
    if (accountId === targetParentId) {
      throw new BadRequestException('An account cannot be its own parent.');
    }

    let currentId: string | null = targetParentId;
    const visited = new Set<string>([accountId]);

    while (currentId) {
      if (visited.has(currentId)) {
        throw new BadRequestException(
          'Circular hierarchy detected in Chart of Accounts.',
        );
      }
      visited.add(currentId);

      const parent: { parentId: string | null } | null =
        await this.prisma.account.findFirst({
          where: { id: currentId, organizationId, deletedAt: null },
          select: { parentId: true },
        });

      currentId = parent ? parent.parentId : null;
    }
  }

  /**
   * Create a new general ledger account in Chart of Accounts.
   */
  async create(
    organizationId: string,
    dto: CreateAccountDto,
    actorUserId?: string,
  ): Promise<Account> {
    const code = dto.code.trim().toUpperCase();

    // 1. Verify code uniqueness within tenant
    const existing = await this.prisma.account.findFirst({
      where: {
        organizationId,
        code,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Account with code '${code}' already exists in this organization.`,
      );
    }

    // 2. Verify parent account if supplied
    if (dto.parentId) {
      const parent = await this.prisma.account.findFirst({
        where: {
          id: dto.parentId,
          organizationId,
          deletedAt: null,
        },
      });

      if (!parent) {
        throw new NotFoundException(
          `Parent account with ID ${dto.parentId} not found in this organization.`,
        );
      }
    }

    const account = await this.prisma.account.create({
      data: {
        organizationId,
        code,
        name: dto.name.trim(),
        type: dto.type,
        parentId: dto.parentId ?? null,
        description: dto.description?.trim() ?? null,
        isActive: dto.isActive ?? true,
        isSystem: dto.isSystem ?? false,
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'account.create',
      resource: 'account',
      resourceId: account.id,
      details: { code: account.code, name: account.name, type: account.type },
    });

    return account;
  }

  /**
   * List accounts with pagination and filters.
   */
  async findAll(
    organizationId: string,
    query: AccountQueryDto,
  ): Promise<{
    accounts: Account[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.AccountWhereInput = {
      organizationId,
      deletedAt: null,
    };

    if (query.type) where.type = query.type;
    if (query.parentId !== undefined) where.parentId = query.parentId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    if (query.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, accounts] = await Promise.all([
      this.prisma.account.count({ where }),
      this.prisma.account.findMany({
        where,
        include: {
          parent: { select: { id: true, code: true, name: true, type: true } },
          _count: { select: { children: true, journalLines: true } },
        },
        orderBy: [{ code: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      accounts,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Find single account by ID with parent, children, and relations.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<AccountWithDetails> {
    const account = await this.prisma.account.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        parent: { select: { id: true, code: true, name: true, type: true } },
        children: {
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            isActive: true,
          },
          orderBy: { code: 'asc' },
        },
        _count: { select: { journalLines: true, children: true } },
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Account with ID ${id} not found in this organization.`,
      );
    }

    return account;
  }

  /**
   * Update account details.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateAccountDto,
    actorUserId?: string,
  ): Promise<Account> {
    const existing = await this.findOne(organizationId, id);

    // Validate parent if changing
    if (dto.parentId !== undefined && dto.parentId !== null) {
      const parent = await this.prisma.account.findFirst({
        where: { id: dto.parentId, organizationId, deletedAt: null },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent account with ID ${dto.parentId} not found in this organization.`,
        );
      }
      await this.validateNoCircularReference(organizationId, id, dto.parentId);
    }

    const data: Prisma.AccountUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.parentId !== undefined) {
      data.parent = dto.parentId
        ? { connect: { id: dto.parentId } }
        : { disconnect: true };
    }
    if (dto.description !== undefined) {
      data.description = dto.description?.trim() ?? null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.account.update({
      where: { id },
      data,
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'account.update',
      resource: 'account',
      resourceId: updated.id,
      details: { code: existing.code, name: updated.name },
    });

    return updated;
  }

  /**
   * Soft-delete account if not system, has no children, and has no journal lines.
   */
  async softDelete(
    organizationId: string,
    id: string,
    actorUserId?: string,
  ): Promise<{ success: boolean }> {
    const account = await this.findOne(organizationId, id);

    if (account.isSystem) {
      throw new BadRequestException('System accounts cannot be deleted.');
    }

    if (account._count.children > 0) {
      throw new BadRequestException(
        'Cannot delete account with child accounts. Reassign or delete child accounts first.',
      );
    }

    if (account._count.journalLines > 0) {
      throw new BadRequestException(
        'Cannot delete account referenced by journal entries.',
      );
    }

    await this.prisma.account.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNT_DELETED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'account.delete',
      resource: 'account',
      resourceId: id,
      details: { code: account.code, name: account.name },
    });

    return { success: true };
  }
}
