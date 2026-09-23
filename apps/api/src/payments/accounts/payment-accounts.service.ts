import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CreatePaymentAccountDto } from './dto/create-payment-account.dto';
import { UpdatePaymentAccountDto } from './dto/update-payment-account.dto';
import { Prisma } from '@prisma/client';

export type PaymentAccountWithDetails = Prisma.PaymentAccountGetPayload<{
  include: {
    currency: { select: { id: true; code: true; name: true; symbol: true } };
    accountingAccount: {
      select: { id: true; code: true; name: true; type: true };
    };
  };
}>;

@Injectable()
export class PaymentAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Create a new payment account mapped to a GL account.
   */
  async create(
    organizationId: string,
    dto: CreatePaymentAccountDto,
  ): Promise<PaymentAccountWithDetails> {
    // 1. Verify accounting account exists in organization
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountingAccountId, organizationId, deletedAt: null },
    });
    if (!account) {
      throw new NotFoundException(
        `General Ledger Account with ID ${dto.accountingAccountId} not found in this organization.`,
      );
    }
    if (!account.isActive) {
      throw new BadRequestException(
        `General Ledger Account '${account.code} - ${account.name}' is inactive.`,
      );
    }

    // 2. Verify currency exists and is active
    const currency = await this.prisma.currency.findFirst({
      where: { id: dto.currencyId, isActive: true },
    });
    if (!currency) {
      throw new NotFoundException(
        `Currency with ID ${dto.currencyId} not found or inactive.`,
      );
    }

    // 3. Check duplicate code within tenant
    const existing = await this.prisma.paymentAccount.findFirst({
      where: { organizationId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Payment account with code '${dto.code}' already exists in this organization.`,
      );
    }

    const created = await this.prisma.paymentAccount.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        type: dto.type,
        currencyId: dto.currencyId,
        accountingAccountId: dto.accountingAccountId,
        isActive: dto.isActive ?? true,
      },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        accountingAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    return created;
  }

  /**
   * List all payment accounts in tenant organization.
   */
  async findAll(
    organizationId: string,
    isActive?: boolean,
  ): Promise<PaymentAccountWithDetails[]> {
    const where: Prisma.PaymentAccountWhereInput = {
      organizationId,
      deletedAt: null,
    };
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.paymentAccount.findMany({
      where,
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        accountingAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
      orderBy: [{ code: 'asc' }],
    });
  }

  /**
   * Find single payment account by ID.
   */
  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PaymentAccountWithDetails> {
    const account = await this.prisma.paymentAccount.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        accountingAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Payment account with ID ${id} not found in this organization.`,
      );
    }

    return account;
  }

  /**
   * Update payment account.
   */
  async update(
    organizationId: string,
    id: string,
    dto: UpdatePaymentAccountDto,
  ): Promise<PaymentAccountWithDetails> {
    await this.findOne(organizationId, id);

    if (dto.accountingAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.accountingAccountId, organizationId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException(
          `General Ledger Account with ID ${dto.accountingAccountId} not found in this organization.`,
        );
      }
      if (!account.isActive) {
        throw new BadRequestException(
          `General Ledger Account '${account.code} - ${account.name}' is inactive.`,
        );
      }
    }

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

    const data: Prisma.PaymentAccountUpdateInput = {};
    if (dto.name) data.name = dto.name;
    if (dto.type) data.type = dto.type;
    if (dto.currencyId) data.currency = { connect: { id: dto.currencyId } };
    if (dto.accountingAccountId) {
      data.accountingAccount = { connect: { id: dto.accountingAccountId } };
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    return this.prisma.paymentAccount.update({
      where: { id },
      data,
      include: {
        currency: {
          select: { id: true, code: true, name: true, symbol: true },
        },
        accountingAccount: {
          select: { id: true, code: true, name: true, type: true },
        },
      },
    });
  }

  /**
   * Remove / deactivate payment account.
   */
  async remove(
    organizationId: string,
    id: string,
  ): Promise<{ success: boolean }> {
    await this.findOne(organizationId, id);

    const paymentCount = await this.prisma.payment.count({
      where: { paymentAccountId: id, organizationId },
    });

    if (paymentCount > 0) {
      await this.prisma.paymentAccount.update({
        where: { id },
        data: { isActive: false, deletedAt: new Date() },
      });
    } else {
      await this.prisma.paymentAccount.delete({ where: { id } });
    }

    return { success: true };
  }
}
