import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  WarehouseStockService,
  WarehouseStockPosition,
} from './warehouse-stock.service';
import {
  WarehouseQuarantineService,
  QuarantineRecordWithDetails,
} from './warehouse-quarantine.service';
import { WarehouseStockQueryDto } from './dto/stock-query.dto';
import { QuarantineStockDto } from './dto/quarantine-stock.dto';
import {
  InspectQuarantineDto,
  ReleaseQuarantineDto,
  QuarantineQueryDto,
} from './dto/inspect-quarantine.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/stock')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseStockController {
  constructor(
    private readonly stockService: WarehouseStockService,
    private readonly quarantineService: WarehouseQuarantineService,
  ) {}

  @Get()
  @RequirePermissions('warehouse.view')
  async getStock(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseStockQueryDto,
  ): Promise<{
    data: WarehouseStockPosition[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.stockService.getStockPositions(tenant.organizationId, query);
  }

  @Get('quarantine')
  @RequirePermissions('warehouse.quarantine.view')
  async getQuarantines(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QuarantineQueryDto,
  ): Promise<QuarantineRecordWithDetails[]> {
    return this.quarantineService.findAll(tenant.organizationId, query);
  }

  @Post('quarantine')
  @RequirePermissions('warehouse.quarantine.manage')
  @HttpCode(HttpStatus.CREATED)
  async quarantineStock(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: QuarantineStockDto,
  ): Promise<QuarantineRecordWithDetails> {
    return this.quarantineService.quarantineStock(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('quarantine/:id')
  @RequirePermissions('warehouse.quarantine.view')
  async getQuarantine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<QuarantineRecordWithDetails> {
    return this.quarantineService.findOne(tenant.organizationId, id);
  }

  @Put('quarantine/:id/inspect')
  @RequirePermissions('warehouse.quarantine.manage')
  async inspectQuarantine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: InspectQuarantineDto,
  ): Promise<QuarantineRecordWithDetails> {
    return this.quarantineService.inspect(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put('quarantine/:id/release')
  @RequirePermissions('warehouse.quarantine.release')
  async releaseQuarantine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ReleaseQuarantineDto,
  ): Promise<QuarantineRecordWithDetails> {
    return this.quarantineService.release(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
