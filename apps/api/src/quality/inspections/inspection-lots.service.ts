import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { NumberingService } from '../../master-data/numbering/numbering.service';
import { SamplingPlansService } from '../sampling/sampling-plans.service';
import { InspectionDecisionService } from './inspection-decision.service';
import {
  CreateInspectionLotDto,
  RecordInspectionResultsDto,
  MakeInspectionDecisionDto,
  QueryInspectionLotsDto,
} from './dto/inspection-lot.dto';
import {
  Prisma,
  InspectionLotStatus,
  InspectionDecision,
  QualityHoldStatus,
  NonConformanceStatus,
} from '@prisma/client';

@Injectable()
export class InspectionLotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
    private readonly numberingService: NumberingService,
    private readonly samplingService: SamplingPlansService,
    private readonly decisionService: InspectionDecisionService,
  ) {}

  async findAll(organizationId: string, query?: QueryInspectionLotsDto) {
    const where: Prisma.QualityInspectionLotWhereInput = { organizationId };

    if (query?.status) {
      where.status = query.status;
    }
    if (query?.inspectionType) {
      where.inspectionType = query.inspectionType;
    }
    if (query?.itemId) {
      where.itemId = query.itemId;
    }
    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }
    if (query?.goodsReceiptId) {
      where.goodsReceiptId = query.goodsReceiptId;
    }
    if (query?.productionOrderId) {
      where.productionOrderId = query.productionOrderId;
    }
    if (query?.search) {
      where.OR = [
        { lotNumber: { contains: query.search, mode: 'insensitive' } },
        { notes: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return this.prisma.qualityInspectionLot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        item: { select: { id: true, sku: true, name: true } },
        variant: { select: { id: true, sku: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        location: { select: { id: true, code: true, name: true } },
        supplier: { select: { id: true, code: true, name: true } },
        customer: { select: { id: true, code: true, name: true } },
        inspectionPlan: {
          select: { id: true, planNumber: true, name: true, version: true },
        },
        _count: {
          select: { results: true, holds: true, nonConformances: true },
        },
      },
    });
  }

  async findOne(organizationId: string, id: string) {
    const lot = await this.prisma.qualityInspectionLot.findFirst({
      where: { id, organizationId },
      include: {
        item: true,
        variant: true,
        warehouse: true,
        location: true,
        batch: true,
        serial: true,
        goodsReceipt: true,
        purchaseOrder: true,
        productionOrder: true,
        deliveryOrder: true,
        shipment: true,
        supplier: true,
        customer: true,
        inspectionPlan: {
          include: {
            characteristics: { orderBy: { sequence: 'asc' } },
            samplingPlan: true,
          },
        },
        results: {
          include: {
            characteristic: true,
          },
          orderBy: [{ sampleNumber: 'asc' }, { characteristicId: 'asc' }],
        },
        holds: true,
        nonConformances: true,
        capas: true,
      },
    });

    if (!lot) {
      throw new NotFoundException(`Quality inspection lot ${id} not found`);
    }

    return lot;
  }

  async create(
    organizationId: string,
    dto: CreateInspectionLotDto,
    userId: string,
  ) {
    // Validate Item
    const item = await this.prisma.item.findFirst({
      where: { id: dto.itemId, organizationId },
    });
    if (!item) {
      throw new NotFoundException(`Item ${dto.itemId} not found`);
    }

    // Validate Warehouse & Location
    const warehouse = await this.prisma.location.findFirst({
      where: { id: dto.warehouseId, organizationId },
    });
    if (!warehouse) {
      throw new NotFoundException(
        `Warehouse location ${dto.warehouseId} not found`,
      );
    }

    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, organizationId },
    });
    if (!location) {
      throw new NotFoundException(`Location ${dto.locationId} not found`);
    }

    // Resolve or find matching inspection plan
    const plan = dto.inspectionPlanId
      ? await this.prisma.inspectionPlan.findFirst({
          where: { id: dto.inspectionPlanId, organizationId },
          include: { samplingPlan: true, characteristics: true },
        })
      : await this.prisma.inspectionPlan.findFirst({
          where: {
            organizationId,
            itemId: dto.itemId,
            variantId: dto.variantId ?? null,
            inspectionType: dto.inspectionType,
            isActive: true,
          },
          orderBy: { version: 'desc' },
          include: { samplingPlan: true, characteristics: true },
        });

    const totalQty = new Prisma.Decimal(dto.totalQuantity);

    // Compute sample quantity
    let sampleQty: Prisma.Decimal;
    if (dto.sampleQuantity !== undefined) {
      sampleQty = new Prisma.Decimal(dto.sampleQuantity);
    } else if (plan?.samplingPlan) {
      sampleQty = this.samplingService.calculateSampleQuantity(
        plan.samplingPlan,
        totalQty,
      );
    } else {
      sampleQty = totalQty;
    }

    if (sampleQty.gt(totalQty)) {
      throw new BadRequestException(
        `Sample quantity (${sampleQty.toString()}) cannot exceed total inspection quantity (${totalQty.toString()})`,
      );
    }

    let lotNumber = dto.lotNumber;
    if (!lotNumber) {
      const seq = await this.numberingService.nextNumber(
        organizationId,
        'INSPECTION_LOT',
        'QIL-',
      );
      lotNumber = seq.formatted;
    }

    const lot = await this.prisma.$transaction(async (tx) => {
      if (plan && !plan.isImmutable) {
        await tx.inspectionPlan.update({
          where: { id: plan.id },
          data: { isImmutable: true },
        });
      }

      return tx.qualityInspectionLot.create({
        data: {
          organizationId,
          lotNumber,
          inspectionPlanId: plan?.id,
          itemId: dto.itemId,
          variantId: dto.variantId,
          warehouseId: dto.warehouseId,
          locationId: dto.locationId,
          batchId: dto.batchId,
          serialId: dto.serialId,
          inspectionType: dto.inspectionType,
          totalQuantity: totalQty,
          sampleQuantity: sampleQty,
          inspectedQuantity: new Prisma.Decimal(0),
          passedQuantity: new Prisma.Decimal(0),
          failedQuantity: new Prisma.Decimal(0),
          status: InspectionLotStatus.PENDING,
          goodsReceiptId: dto.goodsReceiptId,
          purchaseOrderId: dto.purchaseOrderId,
          productionOrderId: dto.productionOrderId,
          deliveryOrderId: dto.deliveryOrderId,
          shipmentId: dto.shipmentId,
          supplierId: dto.supplierId,
          customerId: dto.customerId,
          notes: dto.notes,
        },
        include: {
          item: true,
          warehouse: true,
          location: true,
          inspectionPlan: {
            include: { characteristics: true },
          },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'INSPECTION_LOT_CREATED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.inspection_lot.create',
      resource: 'inspection_lot',
      resourceId: lot.id,
      details: {
        lotNumber: lot.lotNumber,
        inspectionType: lot.inspectionType,
        totalQuantity: lot.totalQuantity.toString(),
        sampleQuantity: lot.sampleQuantity.toString(),
      },
    });

    return lot;
  }

  async recordResults(
    organizationId: string,
    id: string,
    dto: RecordInspectionResultsDto,
    userId: string,
  ) {
    const lot = await this.findOne(organizationId, id);

    if (lot.status === InspectionLotStatus.DECIDED || lot.isImmutable) {
      throw new BadRequestException(
        'Cannot record results on a finalized inspection lot',
      );
    }

    if (dto.results.length === 0) {
      throw new BadRequestException('Results array cannot be empty');
    }

    // Process observations
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const item of dto.results) {
        // Upsert result
        await tx.inspectionResult.upsert({
          where: {
            organizationId_inspectionLotId_characteristicId_sampleNumber: {
              organizationId,
              inspectionLotId: lot.id,
              characteristicId: item.characteristicId,
              sampleNumber: item.sampleNumber,
            },
          },
          create: {
            organizationId,
            inspectionLotId: lot.id,
            characteristicId: item.characteristicId,
            sampleNumber: item.sampleNumber,
            observedNumericValue:
              item.observedNumericValue !== undefined
                ? new Prisma.Decimal(item.observedNumericValue)
                : null,
            observedTextValue: item.observedTextValue,
            isPass: item.isPass,
            inspectorUserId: userId,
            notes: item.notes,
          },
          update: {
            observedNumericValue:
              item.observedNumericValue !== undefined
                ? new Prisma.Decimal(item.observedNumericValue)
                : null,
            observedTextValue: item.observedTextValue,
            isPass: item.isPass,
            inspectorUserId: userId,
            notes: item.notes,
          },
        });
      }

      // Re-calculate counts
      const allResults = await tx.inspectionResult.findMany({
        where: { inspectionLotId: lot.id, organizationId },
      });

      const uniqueSamples = new Set(allResults.map((r) => r.sampleNumber));
      const failedSamples = new Set(
        allResults.filter((r) => !r.isPass).map((r) => r.sampleNumber),
      );
      const passedSamplesCount = uniqueSamples.size - failedSamples.size;

      const newStatus =
        uniqueSamples.size >= lot.sampleQuantity.toNumber()
          ? InspectionLotStatus.COMPLETED
          : InspectionLotStatus.IN_PROGRESS;

      return tx.qualityInspectionLot.update({
        where: { id: lot.id },
        data: {
          status: newStatus,
          inspectedQuantity: new Prisma.Decimal(uniqueSamples.size),
          passedQuantity: new Prisma.Decimal(passedSamplesCount),
          failedQuantity: new Prisma.Decimal(failedSamples.size),
        },
        include: {
          results: { include: { characteristic: true } },
          inspectionPlan: { include: { characteristics: true } },
        },
      });
    });

    await this.eventBus.publish({
      eventName: 'INSPECTION_RESULT_RECORDED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId ?? null,
      action: 'quality.inspection_result.record',
      resource: 'inspection_lot',
      resourceId: lot.id,
      details: {
        lotNumber: lot.lotNumber,
        recordedCount: dto.results.length,
      },
    });

    return updated;
  }

  async decide(
    organizationId: string,
    id: string,
    dto: MakeInspectionDecisionDto,
    userId: string,
  ) {
    const lot = await this.findOne(organizationId, id);

    if (lot.status === InspectionLotStatus.DECIDED || lot.isImmutable) {
      throw new BadRequestException(
        'Inspection lot has already been decided and is immutable',
      );
    }

    const characteristics = lot.inspectionPlan?.characteristics || [];
    const evaluation = this.decisionService.evaluateResults(
      characteristics,
      lot.results,
      lot.sampleQuantity.toNumber(),
    );

    const config = await this.prisma.qualityConfiguration.findUnique({
      where: { organizationId },
    });
    const requireMandatory = config?.requireAllMandatoryCharacteristics ?? true;

    this.decisionService.validateDecision(
      dto.decision,
      evaluation,
      requireMandatory,
    );

    return this.prisma.$transaction(async (tx) => {
      // 1. If decision is not ACCEPT, generate Quality Hold
      if (dto.decision !== InspectionDecision.ACCEPT) {
        const holdSeq = await this.numberingService.nextNumber(
          organizationId,
          'QUALITY_HOLD',
          'QHD-',
        );

        await tx.qualityHold.create({
          data: {
            organizationId,
            holdNumber: holdSeq.formatted,
            inspectionLotId: lot.id,
            itemId: lot.itemId,
            variantId: lot.variantId,
            warehouseId: lot.warehouseId,
            locationId: lot.locationId,
            batchId: lot.batchId,
            serialId: lot.serialId,
            holdQuantity: lot.totalQuantity,
            status: QualityHoldStatus.ACTIVE,
            reason: `Inspection lot ${lot.lotNumber} decision: ${dto.decision}. ${dto.decisionNotes ?? ''}`,
            createdByUserId: userId,
          },
        });
      }

      // 2. If decision is REJECT, SCRAP, RETURN_TO_SUPPLIER or createNcrOnFailure is true, create NCR
      if (
        dto.createNcrOnFailure ||
        dto.decision === InspectionDecision.REJECT ||
        dto.decision === InspectionDecision.SCRAP ||
        dto.decision === InspectionDecision.RETURN_TO_SUPPLIER
      ) {
        const ncrSeq = await this.numberingService.nextNumber(
          organizationId,
          'NON_CONFORMANCE',
          'NCR-',
        );

        const severity = this.decisionService.getSuggestedNcrSeverity(
          dto.decision,
        );

        await tx.nonConformance.create({
          data: {
            organizationId,
            ncrNumber: ncrSeq.formatted,
            title:
              dto.ncrTitle ??
              `Non-conformance from inspection lot ${lot.lotNumber} (${dto.decision})`,
            description:
              dto.ncrDescription ??
              dto.decisionNotes ??
              `Inspection failed with decision ${dto.decision}`,
            sourceInspectionLotId: lot.id,
            itemId: lot.itemId,
            variantId: lot.variantId,
            batchId: lot.batchId,
            serialId: lot.serialId,
            supplierId: lot.supplierId,
            customerId: lot.customerId,
            productionOrderId: lot.productionOrderId,
            quantityAffected: lot.totalQuantity,
            severity,
            status: NonConformanceStatus.OPEN,
            disposition: dto.decision,
            dispositionNotes: dto.decisionNotes,
            ownerUserId: userId,
          },
        });
      }

      // 3. Mark results immutable
      await tx.inspectionResult.updateMany({
        where: { inspectionLotId: lot.id, organizationId },
        data: { isImmutable: true },
      });

      // 4. Update lot to DECIDED and immutable
      const finalized = await tx.qualityInspectionLot.update({
        where: { id: lot.id },
        data: {
          status: InspectionLotStatus.DECIDED,
          decision: dto.decision,
          decisionNotes: dto.decisionNotes,
          decidedByUserId: userId,
          decidedAt: new Date(),
          isImmutable: true,
        },
        include: {
          holds: true,
          nonConformances: true,
          results: true,
        },
      });

      await this.eventBus.publish({
        eventName: 'INSPECTION_DECISION_MADE',
        occurredAt: new Date(),
        organizationId,
        actorUserId: userId ?? null,
        action: 'quality.inspection_lot.decide',
        resource: 'inspection_lot',
        resourceId: finalized.id,
        details: {
          lotNumber: finalized.lotNumber,
          decision: finalized.decision,
          hasFailures: evaluation.hasFailures,
        },
      });

      return finalized;
    });
  }
}
