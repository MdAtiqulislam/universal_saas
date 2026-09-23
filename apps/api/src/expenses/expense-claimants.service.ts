import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { CreateExpenseClaimantDto } from './dto/create-expense-claimant.dto';
import { UpdateExpenseClaimantDto } from './dto/update-expense-claimant.dto';

@Injectable()
export class ExpenseClaimantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateExpenseClaimantDto,
    actorUserId?: string,
  ) {
    if (dto.employeeNumber) {
      const existing = await this.prisma.expenseClaimant.findFirst({
        where: {
          organizationId,
          employeeNumber: dto.employeeNumber,
          deletedAt: null,
        },
      });
      if (existing) {
        throw new BadRequestException(
          `Claimant with employee number "${dto.employeeNumber}" already exists.`,
        );
      }
    }

    if (dto.defaultPaymentAccountId) {
      const account = await this.prisma.paymentAccount.findFirst({
        where: {
          id: dto.defaultPaymentAccountId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!account) {
        throw new NotFoundException(
          'Specified default payment account not found.',
        );
      }
    }

    const claimant = await this.prisma.expenseClaimant.create({
      data: {
        organizationId,
        userId: dto.userId,
        employeeNumber: dto.employeeNumber,
        name: dto.name,
        email: dto.email,
        department: dto.department,
        defaultPaymentAccountId: dto.defaultPaymentAccountId,
        isActive: dto.isActive ?? true,
      },
      include: { user: true, defaultPaymentAccount: true },
    });

    await this.eventBus.publish({
      eventName: 'EXPENSE_CLAIMANT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'expense_claimant.created',
      resource: 'expense_claimant',
      resourceId: claimant.id,
      details: { name: claimant.name, employeeNumber: claimant.employeeNumber },
    });

    return claimant;
  }

  async findAll(organizationId: string) {
    return this.prisma.expenseClaimant.findMany({
      where: { organizationId, deletedAt: null },
      include: { user: true, defaultPaymentAccount: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(organizationId: string, id: string) {
    const claimant = await this.prisma.expenseClaimant.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { user: true, defaultPaymentAccount: true },
    });
    if (!claimant) {
      throw new NotFoundException(`Expense claimant ${id} not found.`);
    }
    return claimant;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateExpenseClaimantDto,
  ) {
    const existing = await this.findOne(organizationId, id);

    if (dto.defaultPaymentAccountId) {
      const account = await this.prisma.paymentAccount.findFirst({
        where: {
          id: dto.defaultPaymentAccountId,
          organizationId,
          deletedAt: null,
        },
      });
      if (!account) {
        throw new NotFoundException(
          'Specified default payment account not found.',
        );
      }
    }

    return this.prisma.expenseClaimant.update({
      where: { id: existing.id },
      data: {
        ...(dto.userId !== undefined ? { userId: dto.userId } : {}),
        ...(dto.employeeNumber !== undefined
          ? { employeeNumber: dto.employeeNumber }
          : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.department !== undefined ? { department: dto.department } : {}),
        ...(dto.defaultPaymentAccountId !== undefined
          ? { defaultPaymentAccountId: dto.defaultPaymentAccountId }
          : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: { user: true, defaultPaymentAccount: true },
    });
  }
}
