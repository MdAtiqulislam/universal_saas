import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServiceReportQueryDto } from '../dto/service-reports.dto';
import {
  ServiceTicketStatus,
  ServiceOrderStatus,
  ServiceSlaStatus,
  WarrantyStatus,
  Prisma,
} from '@prisma/client';

@Injectable()
export class ServiceReportsService {
  private readonly logger = new Logger(ServiceReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(organizationId: string, query?: ServiceReportQueryDto) {
    const whereTicket: Prisma.ServiceTicketWhereInput = { organizationId };
    const whereOrder: Prisma.ServiceOrderWhereInput = { organizationId };

    if (query?.customerId) {
      whereTicket.customerId = query.customerId;
      whereOrder.customerId = query.customerId;
    }

    const [
      totalTickets,
      openTickets,
      completedTickets,
      breachedTickets,
      totalOrders,
      activeOrders,
      completedOrders,
      warrantyOrders,
      chargeableOrders,
      totalAssets,
    ] = await Promise.all([
      this.prisma.serviceTicket.count({ where: whereTicket }),
      this.prisma.serviceTicket.count({
        where: {
          ...whereTicket,
          status: {
            in: [
              ServiceTicketStatus.OPEN,
              ServiceTicketStatus.TRIAGED,
              ServiceTicketStatus.ASSIGNED,
              ServiceTicketStatus.IN_DIAGNOSIS,
              ServiceTicketStatus.IN_SERVICE,
            ],
          },
        },
      }),
      this.prisma.serviceTicket.count({
        where: {
          ...whereTicket,
          status: {
            in: [
              ServiceTicketStatus.COMPLETED,
              ServiceTicketStatus.HANDED_OVER,
              ServiceTicketStatus.CLOSED,
            ],
          },
        },
      }),
      this.prisma.serviceTicket.count({
        where: {
          ...whereTicket,
          slaStatus: ServiceSlaStatus.BREACHED,
        },
      }),
      this.prisma.serviceOrder.count({ where: whereOrder }),
      this.prisma.serviceOrder.count({
        where: {
          ...whereOrder,
          status: {
            in: [
              ServiceOrderStatus.RELEASED,
              ServiceOrderStatus.IN_PROGRESS,
              ServiceOrderStatus.QUALITY_CHECK,
            ],
          },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          ...whereOrder,
          status: {
            in: [
              ServiceOrderStatus.COMPLETED,
              ServiceOrderStatus.HANDED_OVER,
              ServiceOrderStatus.CLOSED,
            ],
          },
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          ...whereOrder,
          warrantyStatus: WarrantyStatus.ACTIVE,
        },
      }),
      this.prisma.serviceOrder.count({
        where: {
          ...whereOrder,
          customerCharge: { gt: 0 },
        },
      }),
      this.prisma.customerAsset.count({ where: { organizationId } }),
    ]);

    return {
      tickets: {
        total: totalTickets,
        open: openTickets,
        completed: completedTickets,
        breached: breachedTickets,
      },
      serviceOrders: {
        total: totalOrders,
        active: activeOrders,
        completed: completedOrders,
        warranty: warrantyOrders,
        chargeable: chargeableOrders,
      },
      installedBase: {
        totalCustomerAssets: totalAssets,
      },
    };
  }

  async getSlaPerformance(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const where: Prisma.ServiceTicketWhereInput = { organizationId };
    if (query?.customerId) where.customerId = query.customerId;
    if (query?.technicianId) where.assignedTechnicianId = query.technicianId;

    const tickets = await this.prisma.serviceTicket.findMany({
      where,
      select: {
        id: true,
        slaStatus: true,
        openedAt: true,
        resolvedAt: true,
        resolutionDueAt: true,
      },
    });

    const total = tickets.length;
    const met = tickets.filter(
      (t) => t.slaStatus === ServiceSlaStatus.MET,
    ).length;
    const breached = tickets.filter(
      (t) => t.slaStatus === ServiceSlaStatus.BREACHED,
    ).length;
    const atRisk = tickets.filter(
      (t) => t.slaStatus === ServiceSlaStatus.AT_RISK,
    ).length;
    const onTrack = tickets.filter(
      (t) => t.slaStatus === ServiceSlaStatus.ON_TRACK,
    ).length;

    const complianceRate =
      total > 0 ? Number((((total - breached) / total) * 100).toFixed(2)) : 100;

    // Calculate average resolution time in hours
    const resolvedTickets = tickets.filter((t) => t.resolvedAt);
    let totalResolutionHours = 0;
    for (const t of resolvedTickets) {
      if (t.resolvedAt) {
        const diffMs = t.resolvedAt.getTime() - t.openedAt.getTime();
        totalResolutionHours += diffMs / (1000 * 3600);
      }
    }
    const avgResolutionHours =
      resolvedTickets.length > 0
        ? Number((totalResolutionHours / resolvedTickets.length).toFixed(1))
        : 0;

    return {
      totalTickets: total,
      met,
      breached,
      atRisk,
      onTrack,
      slaComplianceRate: complianceRate,
      averageResolutionHours: avgResolutionHours,
    };
  }

  async getTechnicianPerformance(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const technicians = await this.prisma.employee.findMany({
      where: { organizationId, employmentStatus: 'ACTIVE' },
      include: {
        ticketAssignments: true,
        orderAssignments: true,
        serviceLaborEntries: true,
      },
    });

    return technicians.map((tech) => {
      const assignedOrders = tech.orderAssignments.length;
      const completedOrders = tech.orderAssignments.filter(
        (o) =>
          o.status === ServiceOrderStatus.COMPLETED ||
          o.status === ServiceOrderStatus.HANDED_OVER ||
          o.status === ServiceOrderStatus.CLOSED,
      ).length;

      let billableHours = new Prisma.Decimal(0);
      let actualHours = new Prisma.Decimal(0);
      for (const labor of tech.serviceLaborEntries) {
        billableHours = billableHours.plus(labor.billableHours);
        actualHours = actualHours.plus(labor.actualHours);
      }

      const ftfRate =
        assignedOrders > 0
          ? Number(((completedOrders / assignedOrders) * 100).toFixed(1))
          : 100;

      return {
        technicianId: tech.id,
        technicianName: `${tech.firstName} ${tech.lastName}`,
        department: tech.designation || 'Technician',
        assignedJobs: assignedOrders,
        completedJobs: completedOrders,
        billableHours: billableHours.toNumber(),
        actualHours: actualHours.toNumber(),
        firstTimeFixRate: ftfRate,
      };
    });
  }

  async getWarrantyCostReport(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: {
        organizationId,
        warrantyCost: { gt: 0 },
      },
      include: {
        partsRequirements: { where: { warrantyCovered: true } },
        laborEntries: { where: { warrantyCovered: true } },
      },
    });

    let partsWarrantyCost = new Prisma.Decimal(0);
    let laborWarrantyCost = new Prisma.Decimal(0);
    let totalWarrantyCost = new Prisma.Decimal(0);

    for (const order of orders) {
      for (const p of order.partsRequirements) {
        const netQty = Prisma.Decimal.max(
          0,
          p.issuedQuantity.minus(p.returnedQuantity),
        );
        partsWarrantyCost = partsWarrantyCost.plus(netQty.mul(p.unitCost));
      }
      for (const l of order.laborEntries) {
        laborWarrantyCost = laborWarrantyCost.plus(l.laborCost);
      }
      totalWarrantyCost = totalWarrantyCost.plus(order.warrantyCost);
    }

    return {
      totalWarrantyClaims: orders.length,
      partsWarrantyCost: partsWarrantyCost.toNumber(),
      laborWarrantyCost: laborWarrantyCost.toNumber(),
      totalWarrantyExpense: totalWarrantyCost.toNumber(),
    };
  }

  async getServiceProfitability(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const orders = await this.prisma.serviceOrder.findMany({
      where: { organizationId },
      include: {
        partsRequirements: true,
        laborEntries: true,
      },
    });

    let totalRevenue = new Prisma.Decimal(0);
    let totalPartsCost = new Prisma.Decimal(0);
    let totalLaborCost = new Prisma.Decimal(0);
    let totalOtherCost = new Prisma.Decimal(0);
    let totalCost = new Prisma.Decimal(0);

    for (const order of orders) {
      totalRevenue = totalRevenue.plus(order.customerCharge);
      totalPartsCost = totalPartsCost.plus(order.partsCost);
      totalLaborCost = totalLaborCost.plus(order.laborCost);
      totalOtherCost = totalOtherCost.plus(order.otherCost);
      totalCost = totalCost.plus(order.totalCost);
    }

    const netMargin = totalRevenue.minus(totalCost);
    const marginPct = totalRevenue.gt(0)
      ? Number(netMargin.div(totalRevenue).mul(100).toFixed(2))
      : 0;

    return {
      totalOrders: orders.length,
      serviceRevenue: totalRevenue.toNumber(),
      partsCost: totalPartsCost.toNumber(),
      laborCost: totalLaborCost.toNumber(),
      otherCost: totalOtherCost.toNumber(),
      totalCost: totalCost.toNumber(),
      netMargin: netMargin.toNumber(),
      marginPercentage: marginPct,
    };
  }

  async getPartsConsumptionReport(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const parts = await this.prisma.servicePartRequirement.findMany({
      where: { organizationId },
      include: { item: true },
    });

    const itemMap = new Map<
      string,
      {
        itemId: string;
        sku: string;
        name: string;
        quantityIssued: Prisma.Decimal;
        quantityReturned: Prisma.Decimal;
        netQuantity: Prisma.Decimal;
        totalCost: Prisma.Decimal;
        warrantyCost: Prisma.Decimal;
        chargeableRevenue: Prisma.Decimal;
      }
    >();

    for (const p of parts) {
      const existing = itemMap.get(p.itemId) || {
        itemId: p.itemId,
        sku: p.item.sku,
        name: p.item.name,
        quantityIssued: new Prisma.Decimal(0),
        quantityReturned: new Prisma.Decimal(0),
        netQuantity: new Prisma.Decimal(0),
        totalCost: new Prisma.Decimal(0),
        warrantyCost: new Prisma.Decimal(0),
        chargeableRevenue: new Prisma.Decimal(0),
      };

      const netQty = Prisma.Decimal.max(
        0,
        p.issuedQuantity.minus(p.returnedQuantity),
      );
      const cost = netQty.mul(p.unitCost);
      const rev = netQty.mul(p.unitPrice);

      existing.quantityIssued = existing.quantityIssued.plus(p.issuedQuantity);
      existing.quantityReturned = existing.quantityReturned.plus(
        p.returnedQuantity,
      );
      existing.netQuantity = existing.netQuantity.plus(netQty);
      existing.totalCost = existing.totalCost.plus(cost);

      if (p.warrantyCovered) {
        existing.warrantyCost = existing.warrantyCost.plus(cost);
      } else {
        existing.chargeableRevenue = existing.chargeableRevenue.plus(rev);
      }

      itemMap.set(p.itemId, existing);
    }

    return Array.from(itemMap.values()).map((row) => ({
      itemId: row.itemId,
      sku: row.sku,
      name: row.name,
      quantityIssued: row.quantityIssued.toNumber(),
      quantityReturned: row.quantityReturned.toNumber(),
      netQuantity: row.netQuantity.toNumber(),
      totalCost: row.totalCost.toNumber(),
      warrantyCost: row.warrantyCost.toNumber(),
      chargeableRevenue: row.chargeableRevenue.toNumber(),
    }));
  }

  async getRepeatRepairs(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const assets = await this.prisma.customerAsset.findMany({
      where: { organizationId },
      include: {
        customer: true,
        item: true,
        serviceOrders: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    const repeatAssets = assets.filter((a) => a.serviceOrders.length > 1);

    return repeatAssets.map((a) => ({
      customerAssetId: a.id,
      assetNumber: a.assetNumber,
      customerName: a.customer.name,
      itemSku: a.item.sku,
      itemName: a.item.name,
      serialNumber: a.serialNumber,
      totalRepairs: a.serviceOrders.length,
      lastRepairedAt: a.serviceOrders[0]?.createdAt,
    }));
  }

  async getFailureAnalysis(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const diagnoses = await this.prisma.serviceDiagnosis.findMany({
      where: { organizationId },
    });

    const categoryMap = new Map<string, number>();
    for (const d of diagnoses) {
      const code = d.diagnosisCode || 'UNCATEGORIZED';
      categoryMap.set(code, (categoryMap.get(code) || 0) + 1);
    }

    return Array.from(categoryMap.entries()).map(([diagnosisCode, count]) => ({
      diagnosisCode,
      count,
      percentage:
        diagnoses.length > 0
          ? Number(((count / diagnoses.length) * 100).toFixed(1))
          : 0,
    }));
  }

  async getWorkOrderAging(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const activeOrders = await this.prisma.serviceOrder.findMany({
      where: {
        organizationId,
        status: {
          in: [
            ServiceOrderStatus.DRAFT,
            ServiceOrderStatus.RELEASED,
            ServiceOrderStatus.IN_PROGRESS,
            ServiceOrderStatus.QUALITY_CHECK,
          ],
        },
      },
      include: { customer: true },
    });

    const now = new Date();
    let zeroTo7 = 0;
    let eightTo14 = 0;
    let fifteenTo30 = 0;
    let over30 = 0;

    for (const o of activeOrders) {
      const ageDays =
        (now.getTime() - o.createdAt.getTime()) / (1000 * 3600 * 24);
      if (ageDays <= 7) zeroTo7++;
      else if (ageDays <= 14) eightTo14++;
      else if (ageDays <= 30) fifteenTo30++;
      else over30++;
    }

    return {
      totalOpenOrders: activeOrders.length,
      buckets: {
        '0-7 days': zeroTo7,
        '8-14 days': eightTo14,
        '15-30 days': fifteenTo30,
        '30+ days': over30,
      },
    };
  }

  async getRmaToServiceReport(
    organizationId: string,
    query?: ServiceReportQueryDto,
  ) {
    const rmaOrders = await this.prisma.serviceOrder.findMany({
      where: {
        organizationId,
        sourceRmaId: { not: null },
      },
      include: {
        sourceRma: true,
        customer: true,
      },
    });

    const completed = rmaOrders.filter(
      (o) =>
        o.status === ServiceOrderStatus.COMPLETED ||
        o.status === ServiceOrderStatus.HANDED_OVER ||
        o.status === ServiceOrderStatus.CLOSED,
    ).length;

    return {
      totalRmaConversions: rmaOrders.length,
      completedRmaOrders: completed,
      activeRmaOrders: rmaOrders.length - completed,
      orders: rmaOrders.map((o) => ({
        serviceOrderId: o.id,
        serviceOrderNumber: o.serviceOrderNumber,
        rmaNumber: o.sourceRma?.returnNumber,
        customerName: o.customer.name,
        status: o.status,
        createdAt: o.createdAt,
      })),
    };
  }
}
