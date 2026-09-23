import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmReportFilterDto } from '../dto/crm-reports.dto';
import {
  LeadStatus,
  LeadSource,
  OpportunityStatus,
  OpportunityStage,
  QuotationStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class CrmReportsService {
  private readonly logger = new Logger(CrmReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private applyDateFilter(
    filter?: CrmReportFilterDto,
  ): Prisma.DateTimeFilter | undefined {
    if (!filter?.startDate && !filter?.endDate) return undefined;
    const res: Prisma.DateTimeFilter = {};
    if (filter.startDate) res.gte = new Date(filter.startDate);
    if (filter.endDate) res.lte = new Date(filter.endDate);
    return res;
  }

  // 1. Lead Funnel Report
  async getLeadFunnelReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, createdAt },
    });

    const total = leads.length;
    const newLeads = leads.filter((l) => l.status === LeadStatus.NEW).length;
    const contacted = leads.filter(
      (l) => l.status === LeadStatus.CONTACTED,
    ).length;
    const qualified = leads.filter(
      (l) => l.status === LeadStatus.QUALIFIED,
    ).length;
    const converted = leads.filter(
      (l) => l.status === LeadStatus.CONVERTED,
    ).length;
    const lost = leads.filter(
      (l) => l.status === LeadStatus.LOST || l.status === LeadStatus.CLOSED,
    ).length;

    return {
      total,
      funnel: [
        {
          stage: 'NEW',
          count: newLeads,
          percentage: total ? Number(((newLeads / total) * 100).toFixed(1)) : 0,
        },
        {
          stage: 'CONTACTED',
          count: contacted,
          percentage: total
            ? Number(((contacted / total) * 100).toFixed(1))
            : 0,
        },
        {
          stage: 'QUALIFIED',
          count: qualified,
          percentage: total
            ? Number(((qualified / total) * 100).toFixed(1))
            : 0,
        },
        {
          stage: 'CONVERTED',
          count: converted,
          percentage: total
            ? Number(((converted / total) * 100).toFixed(1))
            : 0,
        },
        {
          stage: 'LOST',
          count: lost,
          percentage: total ? Number(((lost / total) * 100).toFixed(1)) : 0,
        },
      ],
      conversionRate: total
        ? Number(((converted / total) * 100).toFixed(2))
        : 0,
    };
  }

  // 2. Lead Source Performance
  async getLeadSourcePerformance(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const leads = await this.prisma.lead.findMany({
      where: { organizationId, createdAt },
      include: { convertedOpportunity: true },
    });

    const sourceMap: Record<
      string,
      { total: number; converted: number; totalValue: Prisma.Decimal }
    > = {};

    for (const l of leads) {
      if (!sourceMap[l.source]) {
        sourceMap[l.source] = {
          total: 0,
          converted: 0,
          totalValue: new Prisma.Decimal(0),
        };
      }
      sourceMap[l.source].total++;
      if (l.status === LeadStatus.CONVERTED) {
        sourceMap[l.source].converted++;
        sourceMap[l.source].totalValue = sourceMap[l.source].totalValue.add(
          l.estimatedValue,
        );
      }
    }

    return Object.entries(sourceMap).map(([source, data]) => ({
      source,
      totalLeads: data.total,
      convertedLeads: data.converted,
      conversionRate: data.total
        ? Number(((data.converted / data.total) * 100).toFixed(2))
        : 0,
      convertedValue: Number(data.totalValue.toFixed(2)),
    }));
  }

  // 3. Opportunity Pipeline
  async getOpportunityPipelineReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const where: Prisma.OpportunityWhereInput = { organizationId, createdAt };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({
      where,
      include: { customer: true, ownerEmployee: true },
    });

    const openOpps = opportunities.filter(
      (o) => o.status === OpportunityStatus.OPEN,
    );
    const totalPipelineValue = openOpps.reduce(
      (acc, o) => acc.add(o.estimatedValue),
      new Prisma.Decimal(0),
    );

    return {
      openOpportunitiesCount: openOpps.length,
      totalPipelineValue: Number(totalPipelineValue.toFixed(2)),
      opportunities: openOpps.map((o) => ({
        id: o.id,
        opportunityNumber: o.opportunityNumber,
        title: o.title,
        customerName: o.customer.name,
        stage: o.stage,
        probability: Number(o.probability),
        estimatedValue: Number(o.estimatedValue),
        expectedCloseDate: o.expectedCloseDate,
        ownerName: o.ownerEmployee
          ? `${o.ownerEmployee.firstName} ${o.ownerEmployee.lastName}`
          : 'Unassigned',
      })),
    };
  }

  // 4. Weighted Pipeline Forecast
  async getWeightedPipelineForecast(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      status: OpportunityStatus.OPEN,
      createdAt,
    };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({ where });

    let unweightedTotal = new Prisma.Decimal(0);
    let weightedTotal = new Prisma.Decimal(0);

    const stageMap: Record<
      string,
      { count: number; unweighted: Prisma.Decimal; weighted: Prisma.Decimal }
    > = {};

    for (const opp of opportunities) {
      unweightedTotal = unweightedTotal.add(opp.estimatedValue);
      const w = opp.estimatedValue.mul(opp.probability).div(100);
      weightedTotal = weightedTotal.add(w);

      if (!stageMap[opp.stage]) {
        stageMap[opp.stage] = {
          count: 0,
          unweighted: new Prisma.Decimal(0),
          weighted: new Prisma.Decimal(0),
        };
      }
      stageMap[opp.stage].count++;
      stageMap[opp.stage].unweighted = stageMap[opp.stage].unweighted.add(
        opp.estimatedValue,
      );
      stageMap[opp.stage].weighted = stageMap[opp.stage].weighted.add(w);
    }

    return {
      totalUnweightedValue: Number(unweightedTotal.toFixed(2)),
      totalWeightedValue: Number(weightedTotal.toFixed(2)),
      stages: Object.entries(stageMap).map(([stage, data]) => ({
        stage,
        dealCount: data.count,
        unweightedValue: Number(data.unweighted.toFixed(2)),
        weightedValue: Number(data.weighted.toFixed(2)),
      })),
    };
  }

  // 5. Opportunity Aging
  async getOpportunityAgingReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      status: OpportunityStatus.OPEN,
    };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({
      where,
      include: { customer: true },
    });

    const now = new Date();
    const buckets = {
      '0-30 days': [] as any[],
      '31-60 days': [] as any[],
      '61-90 days': [] as any[],
      '90+ days': [] as any[],
    };

    for (const opp of opportunities) {
      const ageDays = Math.floor(
        (now.getTime() - opp.createdAt.getTime()) / (1000 * 60 * 60 * 24),
      );
      const oppData = {
        id: opp.id,
        opportunityNumber: opp.opportunityNumber,
        title: opp.title,
        customerName: opp.customer.name,
        stage: opp.stage,
        estimatedValue: Number(opp.estimatedValue),
        ageDays,
      };

      if (ageDays <= 30) buckets['0-30 days'].push(oppData);
      else if (ageDays <= 60) buckets['31-60 days'].push(oppData);
      else if (ageDays <= 90) buckets['61-90 days'].push(oppData);
      else buckets['90+ days'].push(oppData);
    }

    return Object.entries(buckets).map(([bucket, deals]) => ({
      bucket,
      count: deals.length,
      totalValue: deals.reduce((sum, d) => sum + d.estimatedValue, 0),
      deals,
    }));
  }

  // 6. Win/Loss Analysis
  async getWinLossAnalysis(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      status: { in: [OpportunityStatus.WON, OpportunityStatus.LOST] },
      createdAt,
    };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({ where });

    let wonCount = 0;
    let lostCount = 0;
    let wonValue = new Prisma.Decimal(0);
    let lostValue = new Prisma.Decimal(0);

    const lostReasonsMap: Record<string, number> = {};

    for (const opp of opportunities) {
      if (opp.status === OpportunityStatus.WON) {
        wonCount++;
        wonValue = wonValue.add(opp.estimatedValue);
      } else {
        lostCount++;
        lostValue = lostValue.add(opp.estimatedValue);
        const r = opp.lostReason || 'Unspecified';
        lostReasonsMap[r] = (lostReasonsMap[r] || 0) + 1;
      }
    }

    const totalClosed = wonCount + lostCount;
    const winRate =
      totalClosed > 0 ? Number(((wonCount / totalClosed) * 100).toFixed(2)) : 0;

    return {
      totalClosed,
      wonCount,
      wonValue: Number(wonValue.toFixed(2)),
      lostCount,
      lostValue: Number(lostValue.toFixed(2)),
      winRatePercentage: winRate,
      lostReasons: Object.entries(lostReasonsMap).map(([reason, count]) => ({
        reason,
        count,
        percentage: lostCount
          ? Number(((count / lostCount) * 100).toFixed(1))
          : 0,
      })),
    };
  }

  // 7. Sales Rep Performance
  async getSalesRepPerformance(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const [employees, opportunities, activities] = await Promise.all([
      this.prisma.employee.findMany({
        where: { organizationId, deletedAt: null },
      }),
      this.prisma.opportunity.findMany({
        where: { organizationId, createdAt },
      }),
      this.prisma.crmActivity.findMany({
        where: { organizationId, createdAt },
      }),
    ]);

    return employees.map((emp) => {
      const repOpps = opportunities.filter((o) => o.ownerEmployeeId === emp.id);
      const repActs = activities.filter((a) => a.assignedEmployeeId === emp.id);

      const wonOpps = repOpps.filter((o) => o.status === OpportunityStatus.WON);
      const wonValue = wonOpps.reduce(
        (acc, o) => acc.add(o.estimatedValue),
        new Prisma.Decimal(0),
      );
      const pipelineValue = repOpps
        .filter((o) => o.status === OpportunityStatus.OPEN)
        .reduce((acc, o) => acc.add(o.estimatedValue), new Prisma.Decimal(0));

      const totalClosed = repOpps.filter(
        (o) =>
          o.status === OpportunityStatus.WON ||
          o.status === OpportunityStatus.LOST,
      ).length;
      const winRate =
        totalClosed > 0
          ? Number(((wonOpps.length / totalClosed) * 100).toFixed(1))
          : 0;

      return {
        employeeId: emp.id,
        employeeName: `${emp.firstName} ${emp.lastName}`,
        assignedOpportunities: repOpps.length,
        wonOpportunities: wonOpps.length,
        wonValue: Number(wonValue.toFixed(2)),
        pipelineValue: Number(pipelineValue.toFixed(2)),
        winRatePercentage: winRate,
        activitiesLogged: repActs.length,
      };
    });
  }

  // 8. Sales Cycle Analysis
  async getSalesCycleAnalysis(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      status: OpportunityStatus.WON,
    };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const wonOpportunities = await this.prisma.opportunity.findMany({
      where,
      include: { customer: true },
    });

    const cycles = wonOpportunities.map((o) => {
      const close = o.wonDate || o.closedDate || o.updatedAt;
      const days = Math.max(
        0,
        Math.round(
          (close.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24),
        ),
      );
      return {
        id: o.id,
        opportunityNumber: o.opportunityNumber,
        title: o.title,
        customerName: o.customer.name,
        wonValue: Number(o.estimatedValue),
        salesCycleDays: days,
      };
    });

    const avgDays =
      cycles.length > 0
        ? Number(
            (
              cycles.reduce((sum, c) => sum + c.salesCycleDays, 0) /
              cycles.length
            ).toFixed(1),
          )
        : 0;

    return {
      totalWonDeals: cycles.length,
      averageSalesCycleDays: avgDays,
      deals: cycles,
    };
  }

  // 9. Quotation Conversion Report
  async getQuotationConversionReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const quotations = await this.prisma.quotation.findMany({
      where: { organizationId, createdAt },
      include: { salesOrders: true },
    });

    const total = quotations.length;
    const accepted = quotations.filter(
      (q) =>
        q.status === QuotationStatus.ACCEPTED ||
        q.status === QuotationStatus.CONVERTED,
    ).length;
    const converted = quotations.filter(
      (q) => q.status === QuotationStatus.CONVERTED,
    ).length;
    const rejected = quotations.filter(
      (q) => q.status === QuotationStatus.REJECTED,
    ).length;

    const totalQuotedValue = quotations.reduce(
      (acc, q) => acc.add(q.grandTotal),
      new Prisma.Decimal(0),
    );
    const convertedValue = quotations
      .filter((q) => q.status === QuotationStatus.CONVERTED)
      .reduce((acc, q) => acc.add(q.grandTotal), new Prisma.Decimal(0));

    return {
      totalQuotations: total,
      acceptedQuotations: accepted,
      convertedQuotations: converted,
      rejectedQuotations: rejected,
      conversionRate: total
        ? Number(((converted / total) * 100).toFixed(2))
        : 0,
      totalQuotedValue: Number(totalQuotedValue.toFixed(2)),
      convertedValue: Number(convertedValue.toFixed(2)),
    };
  }

  // 10. Customer Acquisition Report
  async getCustomerAcquisitionReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const convertedLeads = await this.prisma.lead.findMany({
      where: { organizationId, status: LeadStatus.CONVERTED, createdAt },
      include: { convertedCustomer: true, convertedOpportunity: true },
    });

    return {
      totalAcquiredCustomers: convertedLeads.length,
      acquisitions: convertedLeads.map((l) => ({
        leadNumber: l.leadNumber,
        customerName: l.convertedCustomer?.name || l.name,
        source: l.source,
        convertedAt: l.convertedAt,
        initialOpportunityValue: l.convertedOpportunity
          ? Number(l.convertedOpportunity.estimatedValue)
          : 0,
      })),
    };
  }

  // 11. Revenue Forecast
  async getRevenueForecast(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const where: Prisma.OpportunityWhereInput = {
      organizationId,
      status: OpportunityStatus.OPEN,
    };
    if (filter?.ownerEmployeeId) where.ownerEmployeeId = filter.ownerEmployeeId;

    const opportunities = await this.prisma.opportunity.findMany({ where });

    const monthMap: Record<
      string,
      { unweighted: Prisma.Decimal; weighted: Prisma.Decimal }
    > = {};

    for (const opp of opportunities) {
      const date = opp.expectedCloseDate || new Date();
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthMap[monthKey]) {
        monthMap[monthKey] = {
          unweighted: new Prisma.Decimal(0),
          weighted: new Prisma.Decimal(0),
        };
      }

      monthMap[monthKey].unweighted = monthMap[monthKey].unweighted.add(
        opp.estimatedValue,
      );
      const w = opp.estimatedValue.mul(opp.probability).div(100);
      monthMap[monthKey].weighted = monthMap[monthKey].weighted.add(w);
    }

    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, val]) => ({
        month,
        unweightedForecast: Number(val.unweighted.toFixed(2)),
        weightedForecast: Number(val.weighted.toFixed(2)),
      }));
  }

  // 12. Customer 360 Activity Report
  async getCustomer360ActivityReport(
    organizationId: string,
    filter?: CrmReportFilterDto,
  ) {
    const createdAt = this.applyDateFilter(filter);
    const activities = await this.prisma.crmActivity.findMany({
      where: { organizationId, createdAt },
      include: { customer: true, assignedEmployee: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const typeBreakdown: Record<string, number> = {};
    for (const a of activities) {
      typeBreakdown[a.type] = (typeBreakdown[a.type] || 0) + 1;
    }

    return {
      totalActivities: activities.length,
      typeBreakdown,
      activities: activities.map((a) => ({
        id: a.id,
        type: a.type,
        subject: a.subject,
        status: a.status,
        customerName: a.customer?.name || 'Prospect/Lead',
        assignedEmployeeName: a.assignedEmployee
          ? `${a.assignedEmployee.firstName} ${a.assignedEmployee.lastName}`
          : 'Unassigned',
        scheduledAt: a.scheduledAt,
        completedAt: a.completedAt,
        outcome: a.outcome,
      })),
    };
  }
}
