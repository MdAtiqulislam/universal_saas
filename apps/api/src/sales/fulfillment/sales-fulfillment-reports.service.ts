import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FulfillmentReportsQueryDto } from './dto/fulfillment-reports-query.dto';
import { Prisma, SalesOrderStatus, DeliveryOrderStatus } from '@prisma/client';

@Injectable()
export class SalesFulfillmentReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 1. Sales Order Summary Report
   */
  async getSalesOrderSummary(
    organizationId: string,
    query: FulfillmentReportsQueryDto,
  ) {
    const where: Prisma.SalesOrderWhereInput = { organizationId };

    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    const orders = await this.prisma.salesOrder.findMany({
      where,
      include: {
        lines: true,
        customerInvoices: {
          where: {
            status: { notIn: ['CANCELLED', 'VOIDED'] },
          },
        },
      },
    });

    const totalOrders = orders.length;
    let totalOrderedQuantity = new Prisma.Decimal(0);
    let totalDeliveredQuantity = new Prisma.Decimal(0);
    let totalOrderedAmount = new Prisma.Decimal(0);
    let totalInvoicedAmount = new Prisma.Decimal(0);

    for (const order of orders) {
      totalOrderedAmount = totalOrderedAmount.add(order.grandTotal);
      for (const line of order.lines) {
        totalOrderedQuantity = totalOrderedQuantity.add(line.quantity);
        totalDeliveredQuantity = totalDeliveredQuantity.add(
          line.quantityDelivered,
        );
      }
      for (const inv of order.customerInvoices) {
        totalInvoicedAmount = totalInvoicedAmount.add(inv.grandTotal);
      }
    }

    const totalRemainingQuantity = totalOrderedQuantity.sub(
      totalDeliveredQuantity,
    );
    const overallFulfillmentRate = totalOrderedQuantity.greaterThan(0)
      ? totalDeliveredQuantity.div(totalOrderedQuantity).mul(100).toNumber()
      : 0;

    return {
      totalOrders,
      totalOrderedQuantity: totalOrderedQuantity.toString(),
      totalDeliveredQuantity: totalDeliveredQuantity.toString(),
      totalRemainingQuantity: totalRemainingQuantity.toString(),
      totalOrderedAmount: totalOrderedAmount.toString(),
      totalInvoicedAmount: totalInvoicedAmount.toString(),
      overallFulfillmentRate: Math.round(overallFulfillmentRate * 100) / 100,
    };
  }

  /**
   * 2. Open Sales Orders Report
   */
  async getOpenSalesOrders(
    organizationId: string,
    query: FulfillmentReportsQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      status: {
        notIn: [
          SalesOrderStatus.CLOSED,
          SalesOrderStatus.CANCELLED,
          SalesOrderStatus.REJECTED,
          SalesOrderStatus.VOIDED,
        ],
      },
    };

    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.status) where.status = query.status;
    if (query.search) {
      where.OR = [
        { orderNumber: { contains: query.search, mode: 'insensitive' } },
        { customer: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, code: true, name: true } },
          location: { select: { id: true, code: true, name: true } },
          currency: { select: { id: true, code: true, symbol: true } },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = orders.map((order) => {
      let orderedQty = new Prisma.Decimal(0);
      let deliveredQty = new Prisma.Decimal(0);
      let reservedQty = new Prisma.Decimal(0);

      for (const line of order.lines) {
        orderedQty = orderedQty.add(line.quantity);
        deliveredQty = deliveredQty.add(line.quantityDelivered);
        reservedQty = reservedQty.add(line.quantityReserved);
      }

      const remainingQty = orderedQty.sub(deliveredQty);
      const fulfillmentPercent = orderedQty.greaterThan(0)
        ? deliveredQty.div(orderedQty).mul(100).toNumber()
        : 0;

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customer: order.customer,
        location: order.location,
        currency: order.currency,
        status: order.status,
        orderDate: order.orderDate,
        expectedDeliveryDate: order.expectedDeliveryDate,
        grandTotal: order.grandTotal.toString(),
        orderedQuantity: orderedQty.toString(),
        deliveredQuantity: deliveredQty.toString(),
        reservedQuantity: reservedQty.toString(),
        remainingQuantity: remainingQty.toString(),
        fulfillmentPercentage: Math.round(fulfillmentPercent * 100) / 100,
      };
    });

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 3. Fulfillment Report
   */
  async getFulfillmentReport(
    organizationId: string,
    query: FulfillmentReportsQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderLineWhereInput = {
      organizationId,
    };

    const soWhere: Prisma.SalesOrderWhereInput = {};
    if (query.customerId) soWhere.customerId = query.customerId;
    if (query.locationId) soWhere.locationId = query.locationId;
    if (query.status) soWhere.status = query.status;
    if (Object.keys(soWhere).length > 0) {
      where.salesOrder = soWhere;
    }

    const [total, lines] = await Promise.all([
      this.prisma.salesOrderLine.count({ where }),
      this.prisma.salesOrderLine.findMany({
        where,
        include: {
          item: { select: { id: true, sku: true, name: true } },
          variant: { select: { id: true, sku: true, name: true } },
          salesOrder: {
            select: {
              id: true,
              orderNumber: true,
              status: true,
              customer: { select: { id: true, code: true, name: true } },
              orderDate: true,
              expectedDeliveryDate: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const items = lines.map((line) => {
      const remaining = line.quantity.sub(line.quantityDelivered);
      const fulfillmentPercent = line.quantity.greaterThan(0)
        ? line.quantityDelivered.div(line.quantity).mul(100).toNumber()
        : 0;

      return {
        lineId: line.id,
        salesOrderId: line.salesOrderId,
        orderNumber: line.salesOrder.orderNumber,
        orderStatus: line.salesOrder.status,
        customer: line.salesOrder.customer,
        item: line.item,
        variant: line.variant,
        orderedQuantity: line.quantity.toString(),
        allocatedQuantity: line.quantityReserved.toString(),
        deliveredQuantity: line.quantityDelivered.toString(),
        remainingQuantity: remaining.toString(),
        unitPrice: line.unitPrice.toString(),
        lineTotal: line.lineTotal.toString(),
        fulfillmentPercentage: Math.round(fulfillmentPercent * 100) / 100,
      };
    });

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 4. Customer Order History
   */
  async getCustomerOrderHistory(
    organizationId: string,
    customerId: string,
    query: FulfillmentReportsQueryDto,
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.SalesOrderWhereInput = {
      organizationId,
      customerId,
    };

    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.orderDate = {};
      if (query.startDate) where.orderDate.gte = new Date(query.startDate);
      if (query.endDate) where.orderDate.lte = new Date(query.endDate);
    }

    const [total, orders] = await Promise.all([
      this.prisma.salesOrder.count({ where }),
      this.prisma.salesOrder.findMany({
        where,
        include: {
          currency: true,
          location: true,
          deliveryOrders: {
            select: {
              id: true,
              deliveryNumber: true,
              status: true,
              deliveredAt: true,
            },
          },
          customerInvoices: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              grandTotal: true,
              amountPaid: true,
            },
          },
          lines: {
            include: {
              item: { select: { id: true, sku: true, name: true } },
            },
          },
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * 5. Delivery Performance Report
   */
  async getDeliveryPerformance(
    organizationId: string,
    query: FulfillmentReportsQueryDto,
  ) {
    const where: Prisma.DeliveryOrderWhereInput = {
      organizationId,
      status: DeliveryOrderStatus.DELIVERED,
    };

    if (query.customerId) where.customerId = query.customerId;
    if (query.locationId) where.locationId = query.locationId;
    if (query.startDate || query.endDate) {
      where.deliveredAt = {};
      if (query.startDate) where.deliveredAt.gte = new Date(query.startDate);
      if (query.endDate) where.deliveredAt.lte = new Date(query.endDate);
    }

    const deliveries = await this.prisma.deliveryOrder.findMany({
      where,
      include: {
        customer: { select: { id: true, code: true, name: true } },
        salesOrder: {
          select: {
            id: true,
            orderNumber: true,
            orderDate: true,
            expectedDeliveryDate: true,
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
    });

    const totalDeliveries = deliveries.length;
    let onTimeCount = 0;
    let delayedCount = 0;

    const deliveryDetails = deliveries.map((d) => {
      const scheduled = d.scheduledDate ?? d.salesOrder.expectedDeliveryDate;
      const actual = d.deliveredAt;

      let isOnTime = true;
      let delayDays = 0;

      if (scheduled && actual) {
        const scheduledTime = new Date(scheduled).getTime();
        const actualTime = new Date(actual).getTime();
        if (actualTime > scheduledTime) {
          isOnTime = false;
          delayDays = Math.ceil(
            (actualTime - scheduledTime) / (1000 * 60 * 60 * 24),
          );
        }
      }

      if (isOnTime) {
        onTimeCount++;
      } else {
        delayedCount++;
      }

      return {
        id: d.id,
        deliveryNumber: d.deliveryNumber,
        salesOrderNumber: d.salesOrder.orderNumber,
        customer: d.customer,
        scheduledDate: scheduled,
        deliveredAt: actual,
        isOnTime,
        delayDays,
      };
    });

    const onTimeRate =
      totalDeliveries > 0 ? (onTimeCount / totalDeliveries) * 100 : 100;

    return {
      totalDeliveries,
      onTimeCount,
      delayedCount,
      onTimeRate: Math.round(onTimeRate * 100) / 100,
      deliveries: deliveryDetails,
    };
  }
}
