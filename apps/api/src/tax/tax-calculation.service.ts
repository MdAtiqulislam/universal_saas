import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { TaxCodesService } from './tax-codes.service';
import { TaxRatesService } from './tax-rates.service';
import { TaxRulesService } from './tax-rules.service';
import { CalculateTaxDto } from './dto/calculate-tax.dto';
import { Prisma } from '@prisma/client';

export interface TaxCalculationLineResult {
  itemId: string;
  variantId?: string | null;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  taxableAmount: Prisma.Decimal;
  taxRate: Prisma.Decimal;
  taxAmount: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  taxCodeId: string;
  taxCode: string;
  isInclusive: boolean;
  jurisdictionId?: string | null;
  calculationSource: string; // 'OVERRIDE' | 'TAX_RULE' | 'DEFAULT'
}

export interface TaxCalculationResult {
  transactionDate: Date;
  lines: TaxCalculationLineResult[];
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxableTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  grandTotal: Prisma.Decimal;
}

@Injectable()
export class TaxCalculationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly taxCodesService: TaxCodesService,
    private readonly taxRatesService: TaxRatesService,
    private readonly taxRulesService: TaxRulesService,
  ) {}

  /**
   * Execute deterministic tax calculation for a collection of lines.
   */
  async calculate(
    organizationId: string,
    dto: CalculateTaxDto,
    actorUserId?: string,
  ): Promise<TaxCalculationResult> {
    const txDate = new Date(dto.transactionDate);
    const lineResults: TaxCalculationLineResult[] = [];

    let subtotalSum = new Prisma.Decimal(0);
    let discountSum = new Prisma.Decimal(0);
    let taxableSum = new Prisma.Decimal(0);
    let taxSum = new Prisma.Decimal(0);
    let grandTotalSum = new Prisma.Decimal(0);

    // Fetch customer category / item categories if needed
    const itemIds = dto.lines.map((l) => l.itemId);
    const items = await this.prisma.item.findMany({
      where: { id: { in: itemIds }, organizationId },
    });
    const itemMap = new Map(items.map((i) => [i.id, i]));

    for (const line of dto.lines) {
      const qty = new Prisma.Decimal(line.quantity);
      const unitPrice = new Prisma.Decimal(line.unitPrice);
      const discount = new Prisma.Decimal(line.discount ?? 0);
      const item = itemMap.get(line.itemId);

      const lineSubtotal = qty.mul(unitPrice).sub(discount);
      subtotalSum = subtotalSum.add(qty.mul(unitPrice));
      discountSum = discountSum.add(discount);

      let selectedTaxCodeId: string | null = null;
      let selectedTaxCodeName = 'STANDARD_VAT';
      let calculationSource = 'DEFAULT';
      let selectedJurisdictionId: string | null = dto.jurisdictionId ?? null;

      // 1. Direct tax code override
      if (line.taxCodeOverride) {
        // Find by ID or code
        const directCode = await this.prisma.taxCode.findFirst({
          where: {
            organizationId,
            OR: [{ id: line.taxCodeOverride }, { code: line.taxCodeOverride }],
          },
        });
        if (directCode) {
          selectedTaxCodeId = directCode.id;
          selectedTaxCodeName = directCode.code;
          calculationSource = 'OVERRIDE';
          if (directCode.jurisdictionId) {
            selectedJurisdictionId = directCode.jurisdictionId;
          }
        }
      }

      // 2. Deterministic Tax Rule matching
      if (!selectedTaxCodeId) {
        const matchedRule = await this.taxRulesService.findMatchingRule(
          organizationId,
          {
            transactionDate: txDate,
            transactionType: dto.transactionType,
            customerId: dto.customerId,
            supplierId: dto.supplierId,
            customerGroupId: dto.customerGroupId,
            itemId: line.itemId,
            itemCategoryId: item?.categoryId ?? null,
            jurisdictionId: dto.jurisdictionId ?? null,
          },
        );

        if (matchedRule) {
          selectedTaxCodeId = matchedRule.taxCodeId;
          selectedTaxCodeName = matchedRule.taxCode.code;
          calculationSource = `TAX_RULE:${matchedRule.name}`;
          if (matchedRule.jurisdictionId) {
            selectedJurisdictionId = matchedRule.jurisdictionId;
          }
        }
      }

      // 3. Fallback to default active tax code
      if (!selectedTaxCodeId) {
        const defaultCode = await this.prisma.taxCode.findFirst({
          where: { organizationId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (defaultCode) {
          selectedTaxCodeId = defaultCode.id;
          selectedTaxCodeName = defaultCode.code;
          calculationSource = 'DEFAULT';
          if (defaultCode.jurisdictionId) {
            selectedJurisdictionId = defaultCode.jurisdictionId;
          }
        }
      }

      // 4. Resolve effective rate for selected tax code
      let rateDecimal = new Prisma.Decimal(0);
      let isInclusive = false;

      if (selectedTaxCodeId) {
        const effRate = await this.taxRatesService.findEffectiveRate(
          organizationId,
          selectedTaxCodeId,
          txDate,
        );
        if (effRate) {
          rateDecimal = effRate.rate;
          isInclusive = effRate.isInclusive;
        }
      }

      // 5. Line calculations
      let taxableAmount: Prisma.Decimal;
      let taxAmount: Prisma.Decimal;
      let lineTotal: Prisma.Decimal;

      if (isInclusive) {
        // Inclusive: lineSubtotal is total inclusive of tax
        // taxable = lineSubtotal / (1 + rate)
        // tax = lineSubtotal - taxable
        const divisor = new Prisma.Decimal(1).add(rateDecimal);
        taxableAmount = lineSubtotal.dividedBy(divisor);
        taxAmount = lineSubtotal.sub(taxableAmount);
        lineTotal = lineSubtotal;
      } else {
        // Exclusive: taxable = lineSubtotal, tax = taxable * rate, total = taxable + tax
        taxableAmount = lineSubtotal;
        taxAmount = taxableAmount.mul(rateDecimal);
        lineTotal = taxableAmount.add(taxAmount);
      }

      taxableSum = taxableSum.add(taxableAmount);
      taxSum = taxSum.add(taxAmount);
      grandTotalSum = grandTotalSum.add(lineTotal);

      lineResults.push({
        itemId: line.itemId,
        variantId: line.variantId ?? null,
        quantity: qty,
        unitPrice,
        discount,
        lineSubtotal,
        taxableAmount,
        taxRate: rateDecimal,
        taxAmount,
        lineTotal,
        taxCodeId: selectedTaxCodeId ?? '00000000-0000-0000-0000-000000000000',
        taxCode: selectedTaxCodeName,
        isInclusive,
        jurisdictionId: selectedJurisdictionId,
        calculationSource,
      });
    }

    const result: TaxCalculationResult = {
      transactionDate: txDate,
      lines: lineResults,
      subtotal: subtotalSum,
      discountTotal: discountSum,
      taxableTotal: taxableSum,
      taxTotal: taxSum,
      grandTotal: grandTotalSum,
    };

    await this.eventBus.publish({
      eventName: 'TAX_CALCULATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      action: 'tax.calculated',
      resource: 'tax_calculation',
      details: {
        linesCount: dto.lines.length,
        taxableTotal: taxableSum.toFixed(4),
        taxTotal: taxSum.toFixed(4),
        grandTotal: grandTotalSum.toFixed(4),
      },
    });

    return result;
  }
}
