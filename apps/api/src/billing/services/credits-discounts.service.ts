import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingInvoiceRepository } from '../repositories/billing-invoice.repository';
import {
  GrantCreditDto,
  CreateDiscountDto,
} from '../dto/billing-credit-discount.dto';
import { BillingCreditType } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { StructuredLoggingService } from '../../operations/logging/structured-logging.service';

@Injectable()
export class CreditsDiscountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoiceRepo: BillingInvoiceRepository,
    private readonly audit: AuditService,
    private readonly logger: StructuredLoggingService,
  ) {}

  async grantCredit(
    organizationId: string,
    dto: GrantCreditDto,
    actorUserId?: string,
  ) {
    if (!organizationId) {
      throw new BadRequestException('Organization ID is required');
    }

    if (dto.amount <= 0) {
      throw new BadRequestException('Credit amount must be greater than zero');
    }

    const credit = await this.invoiceRepo.createCredit({
      organizationId,
      amount: dto.amount,
      currency: dto.currency || 'USD',
      reason: dto.reason,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      consumedAmount: 0,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.credit.granted',
        organizationId,
        actorUserId,
        resource: 'billing_credit',
        resourceId: credit.id,
        details: {
          amount: credit.amount,
          reason: credit.reason,
        },
        eventName: 'billing.credit.granted',
        occurredAt: new Date(),
      });
    }

    return credit;
  }

  async getAvailableCredit(organizationId: string): Promise<number> {
    return this.invoiceRepo.getAvailableCredit(organizationId);
  }

  async listCredits(organizationId: string) {
    return this.prisma.billingCredit.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDiscount(dto: CreateDiscountDto, actorUserId?: string) {
    const code = dto.code.toUpperCase().trim();
    const existing = await this.invoiceRepo.findDiscountByCode(code);
    if (existing) {
      throw new BadRequestException(`Discount code '${code}' already exists`);
    }

    if (
      dto.discountType === BillingCreditType.PERCENTAGE &&
      (dto.value <= 0 || dto.value > 100)
    ) {
      throw new BadRequestException(
        'Percentage discount must be between 1 and 100',
      );
    }

    if (dto.discountType === BillingCreditType.FIXED_AMOUNT && dto.value <= 0) {
      throw new BadRequestException(
        'Fixed amount discount must be greater than zero',
      );
    }

    const discount = await this.invoiceRepo.createDiscount({
      code,
      name: dto.name,
      discountType: dto.discountType,
      value: dto.value,
      duration: dto.duration,
      validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
      maxRedemptions: dto.maxRedemptions,
      timesRedeemed: 0,
    });

    if (actorUserId) {
      await this.audit.record({
        action: 'billing.discount.created',
        organizationId: 'SYSTEM',
        actorUserId,
        resource: 'billing_discount',
        resourceId: discount.id,
        details: {
          code: discount.code,
          discountType: discount.discountType,
          value: discount.value,
        },
        eventName: 'billing.discount.created',
        occurredAt: new Date(),
      });
    }

    return discount;
  }

  async validateDiscount(
    code: string,
    organizationId?: string,
    subtotal: number = 0,
  ) {
    const discount = await this.invoiceRepo.findDiscountByCode(
      code.toUpperCase().trim(),
    );
    if (!discount) {
      throw new NotFoundException(`Discount code '${code}' is invalid`);
    }

    if (discount.organizationId && discount.organizationId !== organizationId) {
      throw new BadRequestException(
        'Discount code is not valid for this organization',
      );
    }

    if (discount.validUntil && discount.validUntil < new Date()) {
      throw new BadRequestException('Discount code has expired');
    }

    if (
      discount.maxRedemptions &&
      discount.timesRedeemed >= discount.maxRedemptions
    ) {
      throw new BadRequestException(
        'Discount code has reached maximum redemptions',
      );
    }

    let calculatedDeduction = 0;
    if (subtotal > 0) {
      if (discount.discountType === BillingCreditType.PERCENTAGE) {
        calculatedDeduction = Math.floor((subtotal * discount.value) / 100);
      } else {
        calculatedDeduction = Math.min(subtotal, discount.value);
      }
    }

    return {
      valid: true,
      discount,
      calculatedDeduction,
    };
  }

  async listDiscounts() {
    return this.invoiceRepo.listDiscounts();
  }
}
