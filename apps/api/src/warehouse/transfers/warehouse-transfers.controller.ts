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
  WarehouseTransfersService,
  WarehouseTransferWithDetails,
} from './warehouse-transfers.service';
import {
  CreateWarehouseTransferDto,
  RejectWarehouseTransferDto,
  WarehouseTransferQueryDto,
} from './dto/create-warehouse-transfer.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/warehouse/transfers')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WarehouseTransfersController {
  constructor(private readonly transfersService: WarehouseTransfersService) {}

  @Post()
  @RequirePermissions('warehouse.transfers.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateWarehouseTransferDto,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('warehouse.transfers.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: WarehouseTransferQueryDto,
  ): Promise<{
    data: WarehouseTransferWithDetails[];
    total: number;
    page: number;
    limit: number;
  }> {
    return this.transfersService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('warehouse.transfers.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.findOne(tenant.organizationId, id);
  }

  @Put(':id/submit')
  @RequirePermissions('warehouse.transfers.manage')
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.submit(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Put(':id/approve')
  @RequirePermissions('warehouse.transfers.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Put(':id/reject')
  @RequirePermissions('warehouse.transfers.approve')
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectWarehouseTransferDto,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.reject(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Put(':id/start')
  @RequirePermissions('warehouse.transfers.execute')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.start(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Put(':id/complete')
  @RequirePermissions('warehouse.transfers.execute')
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.complete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Put(':id/cancel')
  @RequirePermissions('warehouse.transfers.manage')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<WarehouseTransferWithDetails> {
    return this.transfersService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
