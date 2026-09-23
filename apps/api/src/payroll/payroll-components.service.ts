import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePayrollComponentDto,
  UpdatePayrollComponentDto,
} from './dto/create-payroll-component.dto';

@Injectable()
export class PayrollComponentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, dto: CreatePayrollComponentDto) {
    const existing = await this.prisma.payrollComponent.findFirst({
      where: { organizationId, code: dto.code },
    });
    if (existing) {
      throw new ConflictException(
        `Payroll component with code "${dto.code}" already exists in this organization.`,
      );
    }

    if (dto.expenseAccountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: dto.expenseAccountId, organizationId, isActive: true },
      });
      if (!acc) {
        throw new NotFoundException(
          `Expense account ${dto.expenseAccountId} not found.`,
        );
      }
    }

    if (dto.liabilityAccountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: dto.liabilityAccountId, organizationId, isActive: true },
      });
      if (!acc) {
        throw new NotFoundException(
          `Liability account ${dto.liabilityAccountId} not found.`,
        );
      }
    }

    return this.prisma.payrollComponent.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        componentType: dto.componentType,
        calculationType: dto.calculationType ?? 'FIXED',
        taxable: dto.taxable ?? true,
        active: dto.active ?? true,
        expenseAccountId: dto.expenseAccountId ?? null,
        liabilityAccountId: dto.liabilityAccountId ?? null,
      },
      include: {
        expenseAccount: true,
        liabilityAccount: true,
      },
    });
  }

  async findAll(organizationId: string) {
    return this.prisma.payrollComponent.findMany({
      where: { organizationId },
      include: {
        expenseAccount: true,
        liabilityAccount: true,
      },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const comp = await this.prisma.payrollComponent.findFirst({
      where: { id, organizationId },
      include: {
        expenseAccount: true,
        liabilityAccount: true,
      },
    });
    if (!comp) {
      throw new NotFoundException(`Payroll component ${id} not found.`);
    }
    return comp;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdatePayrollComponentDto,
  ) {
    const comp = await this.findOne(organizationId, id);

    if (dto.code && dto.code !== comp.code) {
      const existing = await this.prisma.payrollComponent.findFirst({
        where: { organizationId, code: dto.code, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException(
          `Payroll component with code "${dto.code}" already exists in this organization.`,
        );
      }
    }

    if (dto.expenseAccountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: dto.expenseAccountId, organizationId, isActive: true },
      });
      if (!acc) {
        throw new NotFoundException(
          `Expense account ${dto.expenseAccountId} not found.`,
        );
      }
    }

    if (dto.liabilityAccountId) {
      const acc = await this.prisma.account.findFirst({
        where: { id: dto.liabilityAccountId, organizationId, isActive: true },
      });
      if (!acc) {
        throw new NotFoundException(
          `Liability account ${dto.liabilityAccountId} not found.`,
        );
      }
    }

    return this.prisma.payrollComponent.update({
      where: { id },
      data: {
        ...(dto.code ? { code: dto.code } : {}),
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.componentType ? { componentType: dto.componentType } : {}),
        ...(dto.calculationType
          ? { calculationType: dto.calculationType }
          : {}),
        ...(dto.taxable !== undefined ? { taxable: dto.taxable } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.expenseAccountId !== undefined
          ? { expenseAccountId: dto.expenseAccountId }
          : {}),
        ...(dto.liabilityAccountId !== undefined
          ? { liabilityAccountId: dto.liabilityAccountId }
          : {}),
      },
      include: {
        expenseAccount: true,
        liabilityAccount: true,
      },
    });
  }

  async delete(organizationId: string, id: string) {
    const comp = await this.findOne(organizationId, id);
    return this.prisma.payrollComponent.delete({ where: { id: comp.id } });
  }
}
