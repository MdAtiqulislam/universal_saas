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
import { GoodsReceiptsService } from './goods-receipts.service';
import { CreateGoodsReceiptDto } from './dto/create-receipt.dto';
import { GoodsReceiptQueryDto } from './dto/receipt-query.dto';

@Controller('goods-receipts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class GoodsReceiptsController {
  constructor(private readonly receiptsService: GoodsReceiptsService) {}

  @Get()
  @RequirePermissions('purchasing.receipts.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: GoodsReceiptQueryDto,
  ) {
    const data = await this.receiptsService.findAll(
      tenant.organizationId,
      query,
    );
    return { success: true, ...data };
  }

  @Get(':id')
  @RequirePermissions('purchasing.receipts.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.receiptsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.receipts.manage')
  async createDraft(
    @Body() dto: CreateGoodsReceiptDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.receiptsService.createDraft(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Goods receipt draft created successfully',
    };
  }

  @Post(':id/post')
  @RequirePermissions('purchasing.receipts.post')
  async post(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.receiptsService.postReceipt(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Goods receipt posted and stock received successfully',
    };
  }

  @Post(':id/cancel')
  @RequirePermissions('purchasing.receipts.cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.receiptsService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
    return {
      success: true,
      data,
      message: 'Goods receipt draft cancelled successfully',
    };
  }
}
