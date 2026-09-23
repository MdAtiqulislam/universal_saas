import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { AdjustmentsService } from './adjustments.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';

@Controller('inventory/adjustments')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class AdjustmentsController {
  constructor(private readonly adjustmentsService: AdjustmentsService) {}

  @Post()
  @RequirePermissions('inventory.adjustments.manage')
  async create(
    @Body() dto: CreateAdjustmentDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.adjustmentsService.createAdjustment(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data: {
        movementId: result.movement.id,
        movementType: result.movement.movementType,
        quantity: result.movement.quantity.toString(),
        newQuantityOnHand: result.balance.quantityOnHand.toString(),
      },
      message: 'Inventory adjustment processed successfully',
    };
  }
}
