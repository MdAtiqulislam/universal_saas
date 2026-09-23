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
  WarehouseWavesService,
  PickWaveWithDetails,
} from './warehouse-waves.service';
import { CreatePickWaveDto, WaveQueryDto } from './dto/create-wave.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/waves')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseWavesController {
  constructor(private readonly wavesService: WarehouseWavesService) {}

  @Post()
  @RequirePermissions('warehouse.waves.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePickWaveDto,
  ): Promise<PickWaveWithDetails> {
    return this.wavesService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('warehouse.waves.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WaveQueryDto,
  ): Promise<{
    data: PickWaveWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.wavesService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.waves.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickWaveWithDetails> {
    return this.wavesService.findOne(tenant.organizationId, id);
  }

  @Put(':id/release')
  @RequirePermissions('warehouse.waves.release')
  async release(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickWaveWithDetails> {
    return this.wavesService.release(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/complete')
  @RequirePermissions('warehouse.waves.manage')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickWaveWithDetails> {
    return this.wavesService.complete(tenant.organizationId, id, tenant.userId);
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.waves.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PickWaveWithDetails> {
    return this.wavesService.cancel(tenant.organizationId, id, tenant.userId);
  }
}
