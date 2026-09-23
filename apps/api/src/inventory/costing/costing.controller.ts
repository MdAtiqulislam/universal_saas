import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CostingService } from './costing.service';
import { ValuationQueryDto } from './dto/valuation-query.dto';
import { ItemCostHistoryQueryDto } from './dto/item-cost-history-query.dto';
import { CogsReportQueryDto } from './dto/cogs-report-query.dto';
import { RecordReceiptCostDto } from './dto/record-receipt-cost.dto';
import { RecordIssueCogsDto } from './dto/record-issue-cogs.dto';
import { RecordAdjustmentCostDto } from './dto/record-adjustment-cost.dto';
import { RecordReturnRestockCostDto } from './dto/record-return-restock-cost.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('inventory')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CostingController {
  constructor(private readonly costingService: CostingService) {}

  @Get('valuation')
  @RequirePermissions('inventory.valuation.view')
  async getValuation(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ValuationQueryDto,
  ) {
    return this.costingService.getValuation(tenant.organizationId, query);
  }

  @Get('costing/items/:itemId/history')
  @RequirePermissions('inventory.costing.view')
  async getItemCostHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('itemId') itemId: string,
    @Query() query: ItemCostHistoryQueryDto,
  ) {
    return this.costingService.getItemCostHistory(
      tenant.organizationId,
      itemId,
      query,
    );
  }

  @Get('costing/cogs')
  @RequirePermissions('inventory.cogs.view')
  async getCogsReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CogsReportQueryDto,
  ) {
    return this.costingService.getCogsReport(tenant.organizationId, query);
  }

  @Post('costing/receipt')
  @RequirePermissions('inventory.costing.manage')
  async recordReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordReceiptCostDto,
  ) {
    return this.costingService.recordReceipt(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('costing/issue-cogs')
  @RequirePermissions('inventory.costing.manage')
  async recordIssueCogs(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordIssueCogsDto,
  ) {
    return this.costingService.recordIssueCogs(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('costing/adjustment')
  @RequirePermissions('inventory.costing.manage')
  async recordAdjustment(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordAdjustmentCostDto,
  ) {
    return this.costingService.recordAdjustment(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post('costing/return-restock')
  @RequirePermissions('inventory.costing.manage')
  async recordReturnRestock(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordReturnRestockCostDto,
  ) {
    return this.costingService.recordReturnRestock(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }
}
