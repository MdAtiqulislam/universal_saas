import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ShipmentReportsQueryDto } from './dto/shipment-reports-query.dto';
import { ShipmentStatus, Prisma } from '@prisma/client';

@Injectable()
export class ShipmentReportsService {
  private readonly logger = new Logger(ShipmentReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Shipment Summary Report
   */
  async getShipmentSummary(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    totalShipments: number;
    draftCount: number;
    readyCount: number;
    assignedCount: number;
    dispatchedCount: number;
    inTransitCount: number;
    deliveredCount: number;
    failedCount: number;
    returnedCount: number;
    cancelledCount: number;
    closedCount: number;
    totalShippingCost: string;
    totalInsuranceCost: string;
    totalOtherCost: string;
    totalLogisticsCost: string;
    onTimeDeliveryRate: number;
  }> {
    const where: Prisma.ShipmentWhereInput = { organizationId };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.carrierId) where.carrierId = query.carrierId;
    if (query.customerId) where.customerId = query.customerId;

    const shipments = await this.prisma.shipment.findMany({
      where,
      select: {
        status: true,
        shippingCost: true,
        insuranceCost: true,
        otherCost: true,
        totalLogisticsCost: true,
        estimatedDeliveryDate: true,
        actualDeliveryDate: true,
      },
    });

    let draftCount = 0;
    let readyCount = 0;
    let assignedCount = 0;
    let dispatchedCount = 0;
    let inTransitCount = 0;
    let deliveredCount = 0;
    let failedCount = 0;
    let returnedCount = 0;
    let cancelledCount = 0;
    let closedCount = 0;

    let totalShippingCost = new Prisma.Decimal(0);
    let totalInsuranceCost = new Prisma.Decimal(0);
    let totalOtherCost = new Prisma.Decimal(0);
    let totalLogisticsCost = new Prisma.Decimal(0);

    let onTimeCount = 0;
    let deliveredWithEstimates = 0;

    for (const s of shipments) {
      totalShippingCost = totalShippingCost.plus(s.shippingCost);
      totalInsuranceCost = totalInsuranceCost.plus(s.insuranceCost);
      totalOtherCost = totalOtherCost.plus(s.otherCost);
      totalLogisticsCost = totalLogisticsCost.plus(s.totalLogisticsCost);

      switch (s.status) {
        case ShipmentStatus.DRAFT:
          draftCount++;
          break;
        case ShipmentStatus.READY:
          readyCount++;
          break;
        case ShipmentStatus.ASSIGNED:
          assignedCount++;
          break;
        case ShipmentStatus.DISPATCHED:
          dispatchedCount++;
          break;
        case ShipmentStatus.IN_TRANSIT:
          inTransitCount++;
          break;
        case ShipmentStatus.DELIVERED:
          deliveredCount++;
          break;
        case ShipmentStatus.FAILED:
          failedCount++;
          break;
        case ShipmentStatus.RETURNED:
          returnedCount++;
          break;
        case ShipmentStatus.CANCELLED:
          cancelledCount++;
          break;
        case ShipmentStatus.CLOSED:
          closedCount++;
          break;
      }

      if (
        s.status === ShipmentStatus.DELIVERED &&
        s.actualDeliveryDate &&
        s.estimatedDeliveryDate
      ) {
        deliveredWithEstimates++;
        if (s.actualDeliveryDate <= s.estimatedDeliveryDate) {
          onTimeCount++;
        }
      }
    }

    const onTimeDeliveryRate =
      deliveredWithEstimates > 0
        ? Math.round((onTimeCount / deliveredWithEstimates) * 10000) / 100
        : 100;

    return {
      totalShipments: shipments.length,
      draftCount,
      readyCount,
      assignedCount,
      dispatchedCount,
      inTransitCount,
      deliveredCount,
      failedCount,
      returnedCount,
      cancelledCount,
      closedCount,
      totalShippingCost: totalShippingCost.toFixed(4),
      totalInsuranceCost: totalInsuranceCost.toFixed(4),
      totalOtherCost: totalOtherCost.toFixed(4),
      totalLogisticsCost: totalLogisticsCost.toFixed(4),
      onTimeDeliveryRate,
    };
  }

  /**
   * 2. Open Shipments Report
   */
  async getOpenShipments(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    shipments: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ShipmentWhereInput = {
      organizationId,
      status: {
        in: [
          ShipmentStatus.DRAFT,
          ShipmentStatus.READY,
          ShipmentStatus.ASSIGNED,
          ShipmentStatus.DISPATCHED,
          ShipmentStatus.IN_TRANSIT,
          ShipmentStatus.FAILED,
        ],
      },
    };

    if (query.customerId) where.customerId = query.customerId;
    if (query.carrierId) where.carrierId = query.carrierId;

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { plannedShipDate: 'asc' },
        include: {
          customer: true,
          carrier: true,
          deliveryOrder: true,
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return {
      shipments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Shipment Performance Report
   */
  async getShipmentPerformance(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    totalDelivered: number;
    onTimeDeliveries: number;
    lateDeliveries: number;
    onTimeRate: number;
    avgDeliveryDays: number;
    shipments: Array<{
      id: string;
      shipmentNumber: string;
      customerName: string;
      carrierName: string | null;
      plannedShipDate: Date | null;
      actualShipDate: Date | null;
      estimatedDeliveryDate: Date | null;
      actualDeliveryDate: Date | null;
      daysInTransit: number | null;
      isOnTime: boolean | null;
    }>;
  }> {
    const where: Prisma.ShipmentWhereInput = {
      organizationId,
      status: ShipmentStatus.DELIVERED,
      actualDeliveryDate: { not: null },
    };

    if (query.carrierId) where.carrierId = query.carrierId;
    if (query.customerId) where.customerId = query.customerId;

    const deliveredShipments = await this.prisma.shipment.findMany({
      where,
      include: {
        customer: true,
        carrier: true,
      },
      orderBy: { actualDeliveryDate: 'desc' },
      take: 100,
    });

    let onTimeCount = 0;
    let lateCount = 0;
    let totalTransitDays = 0;
    let transitCalculatedCount = 0;

    const details = deliveredShipments.map((s) => {
      let isOnTime: boolean | null = null;
      if (s.actualDeliveryDate && s.estimatedDeliveryDate) {
        isOnTime = s.actualDeliveryDate <= s.estimatedDeliveryDate;
        if (isOnTime) onTimeCount++;
        else lateCount++;
      }

      let daysInTransit: number | null = null;
      if (s.actualShipDate && s.actualDeliveryDate) {
        const ms = s.actualDeliveryDate.getTime() - s.actualShipDate.getTime();
        daysInTransit = Math.max(
          0,
          Math.round((ms / (1000 * 60 * 60 * 24)) * 10) / 10,
        );
        totalTransitDays += daysInTransit;
        transitCalculatedCount++;
      }

      return {
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        customerName: s.customer.name,
        carrierName: s.carrier?.name ?? null,
        plannedShipDate: s.plannedShipDate,
        actualShipDate: s.actualShipDate,
        estimatedDeliveryDate: s.estimatedDeliveryDate,
        actualDeliveryDate: s.actualDeliveryDate,
        daysInTransit,
        isOnTime,
      };
    });

    const totalDelivered = deliveredShipments.length;
    const evaluatedCount = onTimeCount + lateCount;
    const onTimeRate =
      evaluatedCount > 0
        ? Math.round((onTimeCount / evaluatedCount) * 10000) / 100
        : 100;
    const avgDeliveryDays =
      transitCalculatedCount > 0
        ? Math.round((totalTransitDays / transitCalculatedCount) * 10) / 10
        : 0;

    return {
      totalDelivered,
      onTimeDeliveries: onTimeCount,
      lateDeliveries: lateCount,
      onTimeRate,
      avgDeliveryDays,
      shipments: details,
    };
  }

  /**
   * 4. Carrier Performance Report
   */
  async getCarrierPerformance(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<
    Array<{
      carrierId: string;
      carrierCode: string;
      carrierName: string;
      carrierType: string;
      totalShipments: number;
      deliveredCount: number;
      failedCount: number;
      returnedCount: number;
      onTimeRate: number;
      avgTransitDays: number;
      totalCost: string;
    }>
  > {
    const carrierWhere: Prisma.ShipmentCarrierWhereInput = { organizationId };
    if (query.carrierId) carrierWhere.id = query.carrierId;

    const carriers = await this.prisma.shipmentCarrier.findMany({
      where: carrierWhere,
      include: {
        shipments: {
          select: {
            status: true,
            totalLogisticsCost: true,
            actualShipDate: true,
            actualDeliveryDate: true,
            estimatedDeliveryDate: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    return carriers.map((c) => {
      let deliveredCount = 0;
      let failedCount = 0;
      let returnedCount = 0;
      let onTimeCount = 0;
      let evaluatedOnTimeCount = 0;
      let totalCost = new Prisma.Decimal(0);
      let totalTransitDays = 0;
      let transitCount = 0;

      for (const s of c.shipments) {
        totalCost = totalCost.plus(s.totalLogisticsCost);
        if (s.status === ShipmentStatus.DELIVERED) {
          deliveredCount++;
          if (s.actualDeliveryDate && s.estimatedDeliveryDate) {
            evaluatedOnTimeCount++;
            if (s.actualDeliveryDate <= s.estimatedDeliveryDate) onTimeCount++;
          }
          if (s.actualShipDate && s.actualDeliveryDate) {
            const days =
              (s.actualDeliveryDate.getTime() - s.actualShipDate.getTime()) /
              (1000 * 60 * 60 * 24);
            totalTransitDays += Math.max(0, days);
            transitCount++;
          }
        } else if (s.status === ShipmentStatus.FAILED) {
          failedCount++;
        } else if (s.status === ShipmentStatus.RETURNED) {
          returnedCount++;
        }
      }

      const onTimeRate =
        evaluatedOnTimeCount > 0
          ? Math.round((onTimeCount / evaluatedOnTimeCount) * 10000) / 100
          : 100;
      const avgTransitDays =
        transitCount > 0
          ? Math.round((totalTransitDays / transitCount) * 10) / 10
          : 0;

      return {
        carrierId: c.id,
        carrierCode: c.code,
        carrierName: c.name,
        carrierType: c.carrierType,
        totalShipments: c.shipments.length,
        deliveredCount,
        failedCount,
        returnedCount,
        onTimeRate,
        avgTransitDays,
        totalCost: totalCost.toFixed(4),
      };
    });
  }

  /**
   * 5. Customer Shipment History Report
   */
  async getCustomerShipmentHistory(
    organizationId: string,
    customerId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    customerId: string;
    customerName: string;
    totalShipments: number;
    totalFreightCost: string;
    shipments: any[];
  }> {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId },
    });

    if (!customer) {
      throw new Error(`Customer with ID ${customerId} not found`);
    }

    const where: Prisma.ShipmentWhereInput = {
      organizationId,
      customerId,
    };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const shipments = await this.prisma.shipment.findMany({
      where,
      include: {
        carrier: true,
        deliveryOrder: true,
        lines: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalFreight = new Prisma.Decimal(0);
    for (const s of shipments) {
      totalFreight = totalFreight.plus(s.totalLogisticsCost);
    }

    return {
      customerId: customer.id,
      customerName: customer.name,
      totalShipments: shipments.length,
      totalFreightCost: totalFreight.toFixed(4),
      shipments,
    };
  }

  /**
   * 6. Shipment Cost Report
   */
  async getShipmentCostReport(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    totalShippingCost: string;
    totalInsuranceCost: string;
    totalOtherCost: string;
    totalLogisticsCost: string;
    shipments: Array<{
      id: string;
      shipmentNumber: string;
      carrierName: string | null;
      shippingCost: string;
      insuranceCost: string;
      otherCost: string;
      totalCost: string;
      createdAt: Date;
    }>;
  }> {
    const where: Prisma.ShipmentWhereInput = { organizationId };

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }
    if (query.carrierId) where.carrierId = query.carrierId;

    const shipments = await this.prisma.shipment.findMany({
      where,
      include: { carrier: true },
      orderBy: { createdAt: 'desc' },
    });

    let totalShippingCost = new Prisma.Decimal(0);
    let totalInsuranceCost = new Prisma.Decimal(0);
    let totalOtherCost = new Prisma.Decimal(0);
    let totalLogisticsCost = new Prisma.Decimal(0);

    const details = shipments.map((s) => {
      totalShippingCost = totalShippingCost.plus(s.shippingCost);
      totalInsuranceCost = totalInsuranceCost.plus(s.insuranceCost);
      totalOtherCost = totalOtherCost.plus(s.otherCost);
      totalLogisticsCost = totalLogisticsCost.plus(s.totalLogisticsCost);

      return {
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        carrierName: s.carrier?.name ?? null,
        shippingCost: s.shippingCost.toFixed(4),
        insuranceCost: s.insuranceCost.toFixed(4),
        otherCost: s.otherCost.toFixed(4),
        totalCost: s.totalLogisticsCost.toFixed(4),
        createdAt: s.createdAt,
      };
    });

    return {
      totalShippingCost: totalShippingCost.toFixed(4),
      totalInsuranceCost: totalInsuranceCost.toFixed(4),
      totalOtherCost: totalOtherCost.toFixed(4),
      totalLogisticsCost: totalLogisticsCost.toFixed(4),
      shipments: details,
    };
  }

  /**
   * 7. Tracking Exceptions Report (failed, returned, overdue)
   */
  async getTrackingExceptions(
    organizationId: string,
    query: ShipmentReportsQueryDto,
  ): Promise<{
    failedCount: number;
    returnedCount: number;
    overdueCount: number;
    totalExceptions: number;
    exceptions: any[];
  }> {
    const now = new Date();

    const where: Prisma.ShipmentWhereInput = {
      organizationId,
      OR: [
        { status: ShipmentStatus.FAILED },
        { status: ShipmentStatus.RETURNED },
        {
          status: {
            in: [
              ShipmentStatus.DISPATCHED,
              ShipmentStatus.IN_TRANSIT,
              ShipmentStatus.ASSIGNED,
            ],
          },
          estimatedDeliveryDate: { lt: now },
        },
      ],
    };

    if (query.carrierId) where.carrierId = query.carrierId;
    if (query.customerId) where.customerId = query.customerId;

    const exceptions = await this.prisma.shipment.findMany({
      where,
      include: {
        customer: true,
        carrier: true,
        deliveryOrder: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    let failedCount = 0;
    let returnedCount = 0;
    let overdueCount = 0;

    for (const s of exceptions) {
      if (s.status === ShipmentStatus.FAILED) failedCount++;
      else if (s.status === ShipmentStatus.RETURNED) returnedCount++;
      else if (s.estimatedDeliveryDate && s.estimatedDeliveryDate < now)
        overdueCount++;
    }

    return {
      failedCount,
      returnedCount,
      overdueCount,
      totalExceptions: exceptions.length,
      exceptions,
    };
  }
}
