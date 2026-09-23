import {
  Controller,
  Get,
  Post,
  Param,
  Body,
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
import { TransfersService } from './transfers.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { CompleteTransferDto } from './dto/complete-transfer.dto';
import { StockTransferStatus } from '@prisma/client';

@Controller('inventory/transfers')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Get()
  @RequirePermissions('inventory.transfers.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('status') status?: StockTransferStatus,
  ) {
    const data = await this.transfersService.findAll(tenant.organizationId, {
      status,
    });
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('inventory.transfers.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.transfersService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('inventory.transfers.manage')
  async create(
    @Body() dto: CreateTransferDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.transfersService.createTransfer(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Stock transfer created successfully',
    };
  }

  @Post(':id/complete')
  @RequirePermissions('inventory.transfers.manage')
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTransferDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.transfersService.completeTransfer(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Stock transfer completed successfully',
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('inventory.transfers.manage')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.transfersService.cancelTransfer(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Stock transfer cancelled successfully',
    };
  }
}
