import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { QuerySupplierQualityDto } from './dto/quality-analytics.dto';
import { InspectionDecision, Prisma } from '@prisma/client';

@Injectable()
export class SupplierQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async getSupplierQualitySummary(
    organizationId: string,
    query?: QuerySupplierQualityDto,
  ) {
    const suppliers = await this.prisma.supplier.findMany({
      where: {
        organizationId,
        ...(query?.supplierId && { id: query.supplierId }),
        isActive: true,
      },
      select: { id: true, code: true, name: true },
    });

    const results = [];

    for (const supplier of suppliers) {
      const lots = await this.prisma.qualityInspectionLot.findMany({
        where: {
          organizationId,
          supplierId: supplier.id,
          ...(query?.from && { createdAt: { gte: new Date(query.from) } }),
          ...(query?.to && { createdAt: { lte: new Date(query.to) } }),
        },
      });

      const totalLots = lots.length;
      let acceptedLots = 0;
      let rejectedLots = 0;
      let totalInspectedQty = new Prisma.Decimal(0);
      let totalFailedQty = new Prisma.Decimal(0);

      for (const lot of lots) {
        totalInspectedQty = totalInspectedQty.add(lot.inspectedQuantity);
        totalFailedQty = totalFailedQty.add(lot.failedQuantity);

        if (
          lot.decision === InspectionDecision.ACCEPT ||
          lot.decision === InspectionDecision.ACCEPT_WITH_DEVIATION
        ) {
          acceptedLots++;
        } else if (
          lot.decision === InspectionDecision.REJECT ||
          lot.decision === InspectionDecision.SCRAP ||
          lot.decision === InspectionDecision.RETURN_TO_SUPPLIER
        ) {
          rejectedLots++;
        }
      }

      const ncrCount = await this.prisma.nonConformance.count({
        where: {
          organizationId,
          supplierId: supplier.id,
        },
      });

      const returnCount = await this.prisma.purchaseReturn.count({
        where: {
          organizationId,
          purchaseOrder: { supplierId: supplier.id },
        },
      });

      const lotRejectionRate =
        totalLots > 0
          ? Number(((rejectedLots / totalLots) * 100).toFixed(2))
          : 0;

      const defectRate =
        totalInspectedQty.toNumber() > 0
          ? Number(
              (
                (totalFailedQty.toNumber() / totalInspectedQty.toNumber()) *
                100
              ).toFixed(2),
            )
          : 0;

      const qualityScore = Math.max(
        0,
        Number((100 - lotRejectionRate * 0.7 - ncrCount * 3).toFixed(2)),
      );

      results.push({
        supplierId: supplier.id,
        supplierCode: supplier.code,
        supplierName: supplier.name,
        totalLots,
        acceptedLots,
        rejectedLots,
        lotRejectionRate,
        totalInspectedQty: totalInspectedQty.toNumber(),
        totalFailedQty: totalFailedQty.toNumber(),
        defectRate,
        ncrCount,
        returnCount,
        qualityScore,
      });
    }

    return results;
  }

  async getSupplierScorecard(organizationId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, organizationId },
    });
    if (!supplier) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }

    const summary = await this.getSupplierQualitySummary(organizationId, {
      supplierId,
    });

    const lots = await this.prisma.qualityInspectionLot.findMany({
      where: { organizationId, supplierId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { item: true },
    });

    const ncrs = await this.prisma.nonConformance.findMany({
      where: { organizationId, supplierId },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { item: true },
    });

    return {
      supplier: { id: supplier.id, code: supplier.code, name: supplier.name },
      summary: summary[0] || null,
      recentLots: lots,
      recentNcrs: ncrs,
    };
  }
}
