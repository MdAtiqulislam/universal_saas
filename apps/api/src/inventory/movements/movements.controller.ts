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
import { MovementsService } from './movements.service';
import { MovementQueryDto } from './dto/movement-query.dto';

@Controller('inventory/movements')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class MovementsController {
  constructor(private readonly movementsService: MovementsService) {}

  @Get()
  @RequirePermissions('inventory.movements.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: MovementQueryDto,
  ) {
    const data = await this.movementsService.findAll(
      tenant.organizationId,
      query,
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('inventory.movements.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.movementsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }
}
