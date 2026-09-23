import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { Prisma } from '@prisma/client';

export const SUPPORTED_ACCOUNT_MAPPING_KEYS = [
  'ACCOUNTS_PAYABLE',
  'PURCHASE_EXPENSE',
  'INVENTORY_ASSET',
  'INPUT_TAX',
  'PURCHASE_DISCOUNT',
  'ACCOUNTS_RECEIVABLE',
  'SALES_REVENUE',
  'OUTPUT_TAX',
  'SALES_DISCOUNT',
  'SALES_RETURNS',
  'COGS',
  'PURCHASE_CLEARING',
  'INVENTORY_ADJUSTMENT_GAIN',
  'INVENTORY_ADJUSTMENT_LOSS',
  'TAX_PAYABLE',
  'TAX_RECEIVABLE',
  'TAX_ADJUSTMENT',
  'EMPLOYEE_EXPENSE_PAYABLE',
  'EXPENSE_REIMBURSEMENT',
  'EXPENSE_INPUT_TAX',
  'FIXED_ASSET',
  'ACCUMULATED_DEPRECIATION',
  'DEPRECIATION_EXPENSE',
  'ASSET_DISPOSAL_GAIN',
  'ASSET_DISPOSAL_LOSS',
] as const;

export type AccountMappingKey = (typeof SUPPORTED_ACCOUNT_MAPPING_KEYS)[number];

export type AccountingAccountMappingWithAccount =
  Prisma.AccountingAccountMappingGetPayload<{
    include: {
      account: {
        select: {
          id: true;
          code: true;
          name: true;
          type: true;
          isActive: true;
        };
      };
    };
  }>;

@Injectable()
export class ApAccountMappingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Set or update an account mapping key for the tenant organization.
   */
  async upsertMapping(
    organizationId: string,
    key: string,
    accountId: string,
    actorUserId?: string,
  ): Promise<AccountingAccountMappingWithAccount> {
    const normalizedKey = key.trim().toUpperCase();

    if (
      !SUPPORTED_ACCOUNT_MAPPING_KEYS.includes(
        normalizedKey as AccountMappingKey,
      )
    ) {
      throw new BadRequestException(
        `Unsupported account mapping key '${key}'. Supported keys are: ${SUPPORTED_ACCOUNT_MAPPING_KEYS.join(', ')}`,
      );
    }

    // Verify account exists in the organization, is active, and not deleted
    const account = await this.prisma.account.findFirst({
      where: {
        id: accountId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!account) {
      throw new NotFoundException(
        `Account with ID ${accountId} not found in this organization.`,
      );
    }

    if (!account.isActive) {
      throw new BadRequestException(
        `Account '${account.code} - ${account.name}' is inactive and cannot be mapped.`,
      );
    }

    const mapping = await this.prisma.accountingAccountMapping.upsert({
      where: {
        organizationId_key: {
          organizationId,
          key: normalizedKey,
        },
      },
      update: {
        accountId,
      },
      create: {
        organizationId,
        key: normalizedKey,
        accountId,
      },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
    });

    await this.eventBus.publish({
      eventName: 'AP_ACCOUNT_MAPPING_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'ap_account_mapping.update',
      resource: 'accounting_account_mapping',
      resourceId: mapping.id,
      details: {
        key: mapping.key,
        accountCode: mapping.account.code,
      },
    });

    return mapping;
  }

  /**
   * Retrieve all configured account mappings for the tenant.
   */
  async findAll(
    organizationId: string,
  ): Promise<AccountingAccountMappingWithAccount[]> {
    return this.prisma.accountingAccountMapping.findMany({
      where: { organizationId },
      include: {
        account: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            isActive: true,
          },
        },
      },
      orderBy: { key: 'asc' },
    });
  }

  /**
   * Resolve a specific account mapping for general ledger posting.
   */
  async resolveAccount(
    organizationId: string,
    key: AccountMappingKey,
  ): Promise<string> {
    const mapping = await this.prisma.accountingAccountMapping.findUnique({
      where: {
        organizationId_key: {
          organizationId,
          key,
        },
      },
      include: {
        account: true,
      },
    });

    if (!mapping || !mapping.account || mapping.account.deletedAt !== null) {
      throw new BadRequestException(
        `Missing required Accounts Payable GL mapping for '${key}'. Please configure account mapping under /api/v1/ap/account-mappings/${key}.`,
      );
    }

    if (!mapping.account.isActive) {
      throw new BadRequestException(
        `Mapped GL account '${mapping.account.code}' for key '${key}' is inactive.`,
      );
    }

    return mapping.accountId;
  }
}
