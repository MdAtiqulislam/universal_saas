import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { BalancesService } from './balances.service';
import { BalanceQueryDto } from './dto/balance-query.dto';

@Controller('inventory/balances')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  @RequirePermissions('inventory.balances.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BalanceQueryDto,
  ) {
    const data = await this.balancesService.findAll(
      tenant.organizationId,
      query,
    );
    return { success: true, ...data };
  }

  @Get(':itemId')
  @RequirePermissions('inventory.balances.view')
  async getByItem(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.balancesService.findOneByItem(
      tenant.organizationId,
      itemId,
    );
    return { success: true, data };
  }
}
