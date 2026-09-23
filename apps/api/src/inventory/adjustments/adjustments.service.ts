import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { StockMovementType } from '@prisma/client';
import {
  BalancesService,
  StockMovementResult,
} from '../balances/balances.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';

@Injectable()
export class AdjustmentsService {
  private readonly logger = new Logger(AdjustmentsService.name);

  constructor(private readonly balancesService: BalancesService) {}

  /**
   * Create an inventory adjustment (ADJUSTMENT_IN or ADJUSTMENT_OUT).
   */
  async createAdjustment(
    organizationId: string,
    dto: CreateAdjustmentDto,
    actorUserId?: string,
  ): Promise<StockMovementResult> {
    if (
      dto.movementType !== StockMovementType.ADJUSTMENT_IN &&
      dto.movementType !== StockMovementType.ADJUSTMENT_OUT
    ) {
      throw new BadRequestException(
        'Adjustment movementType must be either ADJUSTMENT_IN or ADJUSTMENT_OUT',
      );
    }

    return this.balancesService.applyStockMovement(
      organizationId,
      {
        itemId: dto.itemId,
        variantId: dto.variantId,
        locationId: dto.locationId,
        movementType: dto.movementType,
        quantity: dto.quantity,
        batchId: dto.batchId,
        serialId: dto.serialId,
        reason: dto.reason,
        referenceType: 'MANUAL_ADJUSTMENT',
      },
      actorUserId,
    );
  }
}
