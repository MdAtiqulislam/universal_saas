import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { CheckWarrantyEligibilityDto } from '../dto/warranty-policy.dto';
import { WarrantyStatus, WarrantyCoverageType } from '@prisma/client';

export interface WarrantyEligibilityResult {
  eligible: boolean;
  customerAssetId: string;
  assetNumber: string;
  serviceDate: Date;
  warrantyStatus: WarrantyStatus;
  coverageType: WarrantyCoverageType;
  partsCovered: boolean;
  laborCovered: boolean;
  replacementCovered: boolean;
  remainingWarrantyDays: number;
  policyCode?: string;
  policyName?: string;
  reason: string;
}

@Injectable()
export class WarrantyEligibilityService {
  private readonly logger = new Logger(WarrantyEligibilityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async checkEligibility(
    organizationId: string,
    dto: CheckWarrantyEligibilityDto,
    userId?: string,
  ): Promise<WarrantyEligibilityResult> {
    const asset = await this.prisma.customerAsset.findFirst({
      where: { id: dto.customerAssetId, organizationId },
      include: {
        warranties: {
          include: {
            warrantyPolicy: true,
          },
          orderBy: { endDate: 'desc' },
        },
      },
    });

    if (!asset) {
      throw new NotFoundException(
        `Customer asset with ID ${dto.customerAssetId} not found in this organization.`,
      );
    }

    const checkDate = dto.serviceDate ? new Date(dto.serviceDate) : new Date();

    // 1. Check if asset warranty is explicitly VOIDED or EXPIRED
    if (asset.warrantyStatus === WarrantyStatus.VOIDED) {
      const result: WarrantyEligibilityResult = {
        eligible: false,
        customerAssetId: asset.id,
        assetNumber: asset.assetNumber,
        serviceDate: checkDate,
        warrantyStatus: asset.warrantyStatus,
        coverageType: WarrantyCoverageType.NONE,
        partsCovered: false,
        laborCovered: false,
        replacementCovered: false,
        remainingWarrantyDays: 0,
        reason: 'Asset warranty has been voided.',
      };
      await this.publishCheckEvent(organizationId, result, userId);
      return result;
    }

    if (asset.warrantyStatus === WarrantyStatus.NOT_APPLICABLE) {
      const result: WarrantyEligibilityResult = {
        eligible: false,
        customerAssetId: asset.id,
        assetNumber: asset.assetNumber,
        serviceDate: checkDate,
        warrantyStatus: asset.warrantyStatus,
        coverageType: WarrantyCoverageType.NONE,
        partsCovered: false,
        laborCovered: false,
        replacementCovered: false,
        remainingWarrantyDays: 0,
        reason: 'Asset is not covered under warranty.',
      };
      await this.publishCheckEvent(organizationId, result, userId);
      return result;
    }

    // 2. Check asset base warranty dates
    const startDate = new Date(asset.warrantyStartDate);
    const endDate = new Date(asset.warrantyEndDate);

    if (checkDate < startDate) {
      const result: WarrantyEligibilityResult = {
        eligible: false,
        customerAssetId: asset.id,
        assetNumber: asset.assetNumber,
        serviceDate: checkDate,
        warrantyStatus: asset.warrantyStatus,
        coverageType: WarrantyCoverageType.NONE,
        partsCovered: false,
        laborCovered: false,
        replacementCovered: false,
        remainingWarrantyDays: 0,
        reason: `Service date precedes warranty start date (${startDate.toISOString().slice(0, 10)}).`,
      };
      await this.publishCheckEvent(organizationId, result, userId);
      return result;
    }

    // Check attached active warranty policies
    const activeAttachedWarranty = asset.warranties.find((w) => {
      const wStart = new Date(w.startDate);
      const wEnd = new Date(w.endDate);
      return (
        w.status === WarrantyStatus.ACTIVE &&
        checkDate >= wStart &&
        checkDate <= wEnd &&
        w.warrantyPolicy.isActive
      );
    });

    const isWithinBaseWarranty = checkDate <= endDate;
    const remainingMs = Math.max(0, endDate.getTime() - checkDate.getTime());
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    if (!isWithinBaseWarranty && !activeAttachedWarranty) {
      const result: WarrantyEligibilityResult = {
        eligible: false,
        customerAssetId: asset.id,
        assetNumber: asset.assetNumber,
        serviceDate: checkDate,
        warrantyStatus: WarrantyStatus.EXPIRED,
        coverageType: WarrantyCoverageType.NONE,
        partsCovered: false,
        laborCovered: false,
        replacementCovered: false,
        remainingWarrantyDays: 0,
        reason: `Warranty expired on ${endDate.toISOString().slice(0, 10)}.`,
      };
      await this.publishCheckEvent(organizationId, result, userId);
      return result;
    }

    // Policy details
    const policy = activeAttachedWarranty?.warrantyPolicy;
    const coverageType = policy?.coverageType ?? WarrantyCoverageType.FULL;
    const partsCovered = policy ? policy.partsCovered : true;
    const laborCovered = policy ? policy.laborCovered : true;
    const replacementCovered = policy ? policy.replacementCovered : false;

    const result: WarrantyEligibilityResult = {
      eligible: true,
      customerAssetId: asset.id,
      assetNumber: asset.assetNumber,
      serviceDate: checkDate,
      warrantyStatus: WarrantyStatus.ACTIVE,
      coverageType,
      partsCovered,
      laborCovered,
      replacementCovered,
      remainingWarrantyDays: remainingDays,
      policyCode: policy?.code,
      policyName: policy?.name,
      reason: 'Asset is actively covered under warranty.',
    };

    await this.publishCheckEvent(organizationId, result, userId);
    return result;
  }

  private async publishCheckEvent(
    organizationId: string,
    result: WarrantyEligibilityResult,
    userId?: string,
  ) {
    await this.eventBus.publish({
      eventName: 'WARRANTY_ELIGIBILITY_CHECKED',
      occurredAt: new Date(),
      organizationId,
      actorUserId: userId || null,
      action: 'validate',
      resource: 'customer_asset',
      resourceId: result.customerAssetId,
      details: {
        eligible: result.eligible,
        warrantyStatus: result.warrantyStatus,
        coverageType: result.coverageType,
        remainingWarrantyDays: result.remainingWarrantyDays,
      },
    });
  }
}
