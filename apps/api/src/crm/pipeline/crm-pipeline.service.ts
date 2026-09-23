import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PipelineForecastQueryDto } from '../dto/pipeline-query.dto';
import {
  OpportunityStatus,
  OpportunityStage,
  LeadStatus,
  QuotationStatus,
  Prisma,
} from '@prisma/client';

export interface PipelineSummaryResult {
  pipeline: {
    totalOpenOpportunities: number;
    totalOpenValue: number;
    weightedPipelineValue: number;
    wonOpportunities: number;
    wonValue: number;
    lostOpportunities: number;
    lostValue: number;
    winRatePercentage: number;
    averageSalesCycleDays: number;
  };
  leads: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
    lost: number;
  };
  quotations: {
    total: number;
    draft: number;
    submitted: number;
    approved: number;
    accepted: number;
    converted: number;
  };
}

export interface StageBreakdownItem {
  stage: OpportunityStage;
  count: number;
  totalValue: number;
  weightedValue: number;
}

@Injectable()
export class CrmPipelineService {
  private readonly logger = new Logger(CrmPipelineService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPipelineSummary(
    organizationId: string,
    filter?: PipelineForecastQueryDto,
  ): Promise<PipelineSummaryResult> {
    const oppWhere: Prisma.OpportunityWhereInput = { organizationId };

    if (filter?.ownerEmployeeId) {
      oppWhere.ownerEmployeeId = filter.ownerEmployeeId;
    }
    if (filter?.startDate || filter?.endDate) {
      oppWhere.createdAt = {};
      if (filter.startDate) oppWhere.createdAt.gte = new Date(filter.startDate);
      if (filter.endDate) oppWhere.createdAt.lte = new Date(filter.endDate);
    }

    const [opportunities, leads, quotations] = await Promise.all([
      this.prisma.opportunity.findMany({ where: oppWhere }),
      this.prisma.lead.findMany({ where: { organizationId } }),
      this.prisma.quotation.findMany({ where: { organizationId } }),
    ]);

    // Calculate Pipeline metrics
    let totalOpenValue = new Prisma.Decimal(0);
    let weightedPipelineValue = new Prisma.Decimal(0);
    let wonValue = new Prisma.Decimal(0);
    let lostValue = new Prisma.Decimal(0);

    let openCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    const salesCycleDaysArray: number[] = [];

    for (const opp of opportunities) {
      if (opp.status === OpportunityStatus.OPEN) {
        openCount++;
        totalOpenValue = totalOpenValue.add(opp.estimatedValue);
        const weighted = opp.estimatedValue.mul(opp.probability).div(100);
        weightedPipelineValue = weightedPipelineValue.add(weighted);
      } else if (opp.status === OpportunityStatus.WON) {
        wonCount++;
        wonValue = wonValue.add(opp.estimatedValue);

        const closeDate = opp.wonDate || opp.closedDate || opp.updatedAt;
        const days = Math.max(
          0,
          (closeDate.getTime() - opp.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        salesCycleDaysArray.push(days);
      } else if (opp.status === OpportunityStatus.LOST) {
        lostCount++;
        lostValue = lostValue.add(opp.estimatedValue);

        const closeDate = opp.lostDate || opp.closedDate || opp.updatedAt;
        const days = Math.max(
          0,
          (closeDate.getTime() - opp.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        salesCycleDaysArray.push(days);
      }
    }

    const totalClosed = wonCount + lostCount;
    const winRatePercentage =
      totalClosed > 0 ? Number(((wonCount / totalClosed) * 100).toFixed(2)) : 0;

    const averageSalesCycleDays =
      salesCycleDaysArray.length > 0
        ? Number(
            (
              salesCycleDaysArray.reduce((a, b) => a + b, 0) /
              salesCycleDaysArray.length
            ).toFixed(1),
          )
        : 0;

    // Leads summary
    const leadsSummary = {
      total: leads.length,
      new: leads.filter((l) => l.status === LeadStatus.NEW).length,
      qualified: leads.filter((l) => l.status === LeadStatus.QUALIFIED).length,
      converted: leads.filter((l) => l.status === LeadStatus.CONVERTED).length,
      lost: leads.filter(
        (l) => l.status === LeadStatus.LOST || l.status === LeadStatus.CLOSED,
      ).length,
    };

    // Quotations summary
    const quotationsSummary = {
      total: quotations.length,
      draft: quotations.filter((q) => q.status === QuotationStatus.DRAFT)
        .length,
      submitted: quotations.filter(
        (q) => q.status === QuotationStatus.SUBMITTED,
      ).length,
      approved: quotations.filter((q) => q.status === QuotationStatus.APPROVED)
        .length,
      accepted: quotations.filter((q) => q.status === QuotationStatus.ACCEPTED)
        .length,
      converted: quotations.filter(
        (q) => q.status === QuotationStatus.CONVERTED,
      ).length,
    };

    return {
      pipeline: {
        totalOpenOpportunities: openCount,
        totalOpenValue: Number(totalOpenValue.toFixed(2)),
        weightedPipelineValue: Number(weightedPipelineValue.toFixed(2)),
        wonOpportunities: wonCount,
        wonValue: Number(wonValue.toFixed(2)),
        lostOpportunities: lostCount,
        lostValue: Number(lostValue.toFixed(2)),
        winRatePercentage,
        averageSalesCycleDays,
      },
      leads: leadsSummary,
      quotations: quotationsSummary,
    };
  }

  async getStageBreakdown(
    organizationId: string,
    ownerEmployeeId?: string,
  ): Promise<StageBreakdownItem[]> {
    const where: Prisma.OpportunityWhereInput = { organizationId };
    if (ownerEmployeeId) where.ownerEmployeeId = ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({ where });

    const stages: OpportunityStage[] = [
      OpportunityStage.PROSPECTING,
      OpportunityStage.QUALIFICATION,
      OpportunityStage.NEEDS_ANALYSIS,
      OpportunityStage.PROPOSAL,
      OpportunityStage.NEGOTIATION,
      OpportunityStage.CLOSED_WON,
      OpportunityStage.CLOSED_LOST,
    ];

    const breakdown: StageBreakdownItem[] = stages.map((stage) => {
      const stageOpps = opportunities.filter((o) => o.stage === stage);
      let totalVal = new Prisma.Decimal(0);
      let weightedVal = new Prisma.Decimal(0);

      for (const opp of stageOpps) {
        totalVal = totalVal.add(opp.estimatedValue);
        const w = opp.estimatedValue.mul(opp.probability).div(100);
        weightedVal = weightedVal.add(w);
      }

      return {
        stage,
        count: stageOpps.length,
        totalValue: Number(totalVal.toFixed(2)),
        weightedValue: Number(weightedVal.toFixed(2)),
      };
    });

    return breakdown;
  }
}
