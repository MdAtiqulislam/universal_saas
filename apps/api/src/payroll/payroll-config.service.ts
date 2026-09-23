import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePayrollConfigDto } from './dto/update-payroll-config.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(organizationId: string) {
    let config = await this.prisma.payrollConfiguration.findUnique({
      where: { organizationId },
      include: {
        defaultCurrency: true,
        payrollExpenseAccount: true,
        payrollPayableAccount: true,
        payrollTaxPayableAccount: true,
        overtimeExpenseAccount: true,
      },
    });

    if (!config) {
      // Find USD or first active currency
      const defaultCur =
        (await this.prisma.currency.findFirst({
          where: { code: 'USD', isActive: true },
        })) ||
        (await this.prisma.currency.findFirst({ where: { isActive: true } }));

      if (!defaultCur) {
        throw new NotFoundException('No active global currencies found.');
      }

      config = await this.prisma.payrollConfiguration.create({
        data: {
          organizationId,
          defaultCurrencyId: defaultCur.id,
          payrollFrequency: 'MONTHLY',
          workingDaysPerPeriod: 22,
          standardWorkingHours: new Prisma.Decimal(8.0),
          overtimeEnabled: true,
          taxEnabled: true,
          budgetControlPolicy: 'WARN',
        },
        include: {
          defaultCurrency: true,
          payrollExpenseAccount: true,
          payrollPayableAccount: true,
          payrollTaxPayableAccount: true,
          overtimeExpenseAccount: true,
        },
      });
    }

    return config;
  }

  async update(organizationId: string, dto: UpdatePayrollConfigDto) {
    await this.getOrCreate(organizationId);

    // Validate accounts belong to this tenant
    const accountIdsToValidate = [
      dto.payrollExpenseAccountId,
      dto.payrollPayableAccountId,
      dto.payrollTaxPayableAccountId,
      dto.overtimeExpenseAccountId,
    ].filter((id): id is string => Boolean(id));

    if (accountIdsToValidate.length > 0) {
      const accounts = await this.prisma.account.findMany({
        where: {
          id: { in: accountIdsToValidate },
          organizationId,
          isActive: true,
          deletedAt: null,
        },
      });

      if (accounts.length !== new Set(accountIdsToValidate).size) {
        throw new NotFoundException(
          'One or more GL accounts do not exist, are inactive, or belong to another organization.',
        );
      }
    }

    if (dto.defaultCurrencyId) {
      const cur = await this.prisma.currency.findFirst({
        where: { id: dto.defaultCurrencyId, isActive: true },
      });
      if (!cur) {
        throw new NotFoundException(
          `Currency ${dto.defaultCurrencyId} not found.`,
        );
      }
    }

    return this.prisma.payrollConfiguration.update({
      where: { organizationId },
      data: {
        ...(dto.payrollFrequency
          ? { payrollFrequency: dto.payrollFrequency }
          : {}),
        ...(dto.defaultCurrencyId
          ? { defaultCurrencyId: dto.defaultCurrencyId }
          : {}),
        ...(dto.workingDaysPerPeriod !== undefined
          ? { workingDaysPerPeriod: dto.workingDaysPerPeriod }
          : {}),
        ...(dto.standardWorkingHours !== undefined
          ? {
              standardWorkingHours: new Prisma.Decimal(
                dto.standardWorkingHours,
              ),
            }
          : {}),
        ...(dto.overtimeEnabled !== undefined
          ? { overtimeEnabled: dto.overtimeEnabled }
          : {}),
        ...(dto.taxEnabled !== undefined ? { taxEnabled: dto.taxEnabled } : {}),
        ...(dto.budgetControlPolicy
          ? { budgetControlPolicy: dto.budgetControlPolicy }
          : {}),
        ...(dto.payrollExpenseAccountId !== undefined
          ? { payrollExpenseAccountId: dto.payrollExpenseAccountId }
          : {}),
        ...(dto.payrollPayableAccountId !== undefined
          ? { payrollPayableAccountId: dto.payrollPayableAccountId }
          : {}),
        ...(dto.payrollTaxPayableAccountId !== undefined
          ? { payrollTaxPayableAccountId: dto.payrollTaxPayableAccountId }
          : {}),
        ...(dto.overtimeExpenseAccountId !== undefined
          ? { overtimeExpenseAccountId: dto.overtimeExpenseAccountId }
          : {}),
      },
      include: {
        defaultCurrency: true,
        payrollExpenseAccount: true,
        payrollPayableAccount: true,
        payrollTaxPayableAccount: true,
        overtimeExpenseAccount: true,
      },
    });
  }
}
