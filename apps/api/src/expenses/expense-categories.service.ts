import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

@Injectable()
export class ExpenseCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateExpenseCategoryDto,
    actorUserId?: string,
  ) {
    const existing = await this.prisma.expenseCategory.findFirst({
      where: { organizationId, code: dto.code, deletedAt: null },
    });
    if (existing) {
      throw new BadRequestException(
        `Expense category with code "${dto.code}" already exists in this organization.`,
      );
    }

    if (dto.glAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.glAccountId, organizationId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException(
          'Specified GL account not found in this organization.',
        );
      }
    }

    if (dto.taxCodeId) {
      const taxCode = await this.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, organizationId },
      });
      if (!taxCode) {
        throw new NotFoundException(
          'Specified tax code not found in this organization.',
        );
      }
    }

    const category = await this.prisma.expenseCategory.create({
      data: {
        organizationId,
        code: dto.code,
        name: dto.name,
        description: dto.description,
        glAccountId: dto.glAccountId,
        taxCodeId: dto.taxCodeId,
        isActive: dto.isActive ?? true,
      },
      include: { glAccount: true, taxCode: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CATEGORY_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_category.created',
      resource: 'expense_category',
      resourceId: category.id,
      details: { code: category.code, name: category.name },
    });

    return category;
  }

  async findAll(organizationId: string) {
    return this.prisma.expenseCategory.findMany({
      where: { organizationId, deletedAt: null },
      include: { glAccount: true, taxCode: true },
      orderBy: { code: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { glAccount: true, taxCode: true },
    });
    if (!category) {
      throw new NotFoundException(`Expense category ${id} not found.`);
    }
    return category;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateExpenseCategoryDto,
    actorUserId?: string,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.glAccountId) {
      const account = await this.prisma.account.findFirst({
        where: { id: dto.glAccountId, organizationId, deletedAt: null },
      });
      if (!account) {
        throw new NotFoundException(
          'Specified GL account not found in this organization.',
        );
      }
    }

    if (dto.taxCodeId) {
      const taxCode = await this.prisma.taxCode.findFirst({
        where: { id: dto.taxCodeId, organizationId },
      });
      if (!taxCode) {
        throw new NotFoundException(
          'Specified tax code not found in this organization.',
        );
      }
    }

    const updated = await this.prisma.expenseCategory.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.glAccountId !== undefined
          ? { glAccountId: dto.glAccountId }
          : {}),
        ...(dto.taxCodeId !== undefined ? { taxCodeId: dto.taxCodeId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { glAccount: true, taxCode: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CATEGORY_UPDATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_category.updated',
      resource: 'expense_category',
      resourceId: updated.id,
      details: { code: updated.code, name: updated.name },
    });

    return updated;
  }

  async delete(organizationId: string, id: string) {
    const existing = await this.findOne(organizationId, id);

    // Check if category is used in claim lines
    const lineCount = await this.prisma.expenseClaimLine.count({
      where: { organizationId, categoryId: existing.id },
    });

    if (lineCount > 0) {
      return this.prisma.expenseCategory.update({
        where: { id: existing.id },
        data: { deletedAt: new Date(), isActive: false },
      });
    }

    return this.prisma.expenseCategory.delete({
      where: { id: existing.id },
    });
  }
}
