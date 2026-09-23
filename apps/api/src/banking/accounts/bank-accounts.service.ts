import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreateBankAccountProfileDto } from './dto/create-bank-account-profile.dto';
import { UpdateBankAccountProfileDto } from './dto/update-bank-account-profile.dto';
import { Prisma } from '@prisma/client';

export type BankAccountProfileWithDetails =
  Prisma.BankAccountProfileGetPayload<{
    include: {
      paymentAccount: {
        select: {
          id: true;
          code: true;
          name: true;
          type: true;
          accountingAccountId: true;
        };
      };
      currency: {
        select: { id: true; code: true; name: true; symbol: true };
      };
    };
  }>;

@Injectable()
export class BankAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create bank account metadata profile for an existing payment account.
   */
  async create(
    organizationId: string,
    dto: CreateBankAccountProfileDto,
    actorUserId: string,
  ): Promise<BankAccountProfileWithDetails> {
    // 1. Verify payment account exists in organization
    const paymentAccount = await this.prisma.paymentAccount.findFirst({
      where: { id: dto.paymentAccountId, organizationId, deletedAt: null },
    });
    if (!paymentAccount) {
      throw new NotFoundException(
        `Payment account with ID ${dto.paymentAccountId} not found in this organization.`,
      );
    }
    if (!paymentAccount.isActive) {
      throw new BadRequestException(
        `Payment account '${paymentAccount.code} - ${paymentAccount.name}' is inactive.`,
      );
    }

    // 2. Check if a profile already exists for this payment account
    const existingForAccount = await this.prisma.bankAccountProfile.findFirst({
      where: {
        paymentAccountId: dto.paymentAccountId,
        organizationId,
        deletedAt: null,
      },
    });
    if (existingForAccount) {
      throw new BadRequestException(
        `A bank account profile already exists for payment account '${paymentAccount.code}'.`,
      );
    }

    // 3. Check duplicate masked account number in tenant
    const existingMasked = await this.prisma.bankAccountProfile.findFirst({
      where: {
        organizationId,
        accountNumberMasked: dto.accountNumberMasked,
        deletedAt: null,
      },
    });
    if (existingMasked) {
      throw new BadRequestException(
        `A bank account profile with account number '${dto.accountNumberMasked}' already exists in this organization.`,
      );
    }

    // 4. Resolve currency
    const currencyId = dto.currencyId ?? paymentAccount.currencyId;
    const currency = await this.prisma.currency.findFirst({
      where: { id: currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency with ID ${currencyId} not found or inactive.`,
      );
    }

    const created = await this.prisma.bankAccountProfile.create({
      data: {
        organizationId,
        paymentAccountId: dto.paymentAccountId,
        bankName: dto.bankName,
        branchName: dto.branchName?.trim() ?? null,
        accountNumberMasked: dto.accountNumberMasked,
        accountHolderName: dto.accountHolderName,
        routingNumber: dto.routingNumber?.trim() ?? null,
        currencyId,
        isActive: dto.isActive ?? true,
      },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'BANK_ACCOUNT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'bank_account.create',
      resource: 'bank_account_profile',
      resourceId: created.id,
      details: {
        bankName: created.bankName,
        accountNumberMasked: created.accountNumberMasked,
        paymentAccountId: created.paymentAccountId,
      },
    });

    return created;
  }

  /**
   * List all bank account profiles in organization.
   */
  async findAll(
    organizationId: string,
    isActive?: boolean,
  ): Promise<BankAccountProfileWithDetails[]> {
    const where: Prisma.BankAccountProfileWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.bankAccountProfile.findMany({
      where,
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
      orderBy: [{ bankName: 'asc' }],
    });
  }

  /**
   * Find single bank account profile by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<BankAccountProfileWithDetails> {
    const profile = await this.prisma.bankAccountProfile.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Bank account profile with ID ${id} not found in this organization.`,
      );
    }

    return profile;
  }

  /**
   * Update bank account profile.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdateBankAccountProfileDto,
    actorUserId: string,
  ): Promise<BankAccountProfileWithDetails> {
    await this.findOne(organizationId, id);

    if (dto.currencyId) {
      const currency = await this.prisma.currency.findFirst({
        where: { id: dto.currencyId, isActive: true },
      });
      if (!currency) {
        throw new NotFoundException(
          `Currency with ID ${dto.currencyId} not found or inactive.`,
        );
      }
    }

    const data: Prisma.BankAccountProfileUpdateInput = {};
    if (dto.bankName) data.bankName = dto.bankName;
    if (dto.branchName !== undefined)
      data.branchName = dto.branchName?.trim() ?? null;
    if (dto.accountNumberMasked)
      data.accountNumberMasked = dto.accountNumberMasked;
    if (dto.accountHolderName) data.accountHolderName = dto.accountHolderName;
    if (dto.routingNumber !== undefined)
      data.routingNumber = dto.routingNumber?.trim() ?? null;
    if (dto.currencyId) data.currency = { connect: { id: dto.currencyId } };
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.bankAccountProfile.update({
      where: { id },
      data,
      include: {
        paymentAccount: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            accountingAccountId: true,
          },
        },
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'BANK_ACCOUNT_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'bank_account.update',
      resource: 'bank_account_profile',
      resourceId: id,
      details: {
        bankName: updated.bankName,
        accountNumberMasked: updated.accountNumberMasked,
      },
    });

    return updated;
  }

  /**
   * Remove / deactivate bank account profile.
   */
  async remove(
    organizationId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    await this.findOne(organizationId, id);

    await this.prisma.bankAccountProfile.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });

    return { success: true };
  }
}
