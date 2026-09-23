import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';
import { BomsService } from './boms.service';
import { ProductionOrdersService } from './production-orders.service';
import { ProductionExecutionService } from './production-execution.service';
import { ManufacturingConfigService } from './manufacturing-config.service';
import { ManufacturingReportsService } from './manufacturing-reports.service';
import { CreateBomDto } from './dto/create-bom.dto';
import { UpdateBomDto } from './dto/update-bom.dto';
import { BomQueryDto } from './dto/bom-query.dto';
import { CreateProductionOrderDto } from './dto/create-production-order.dto';
import { UpdateProductionOrderDto } from './dto/update-production-order.dto';
import { ProductionOrderQueryDto } from './dto/production-order-query.dto';
import { IssueMaterialDto } from './dto/issue-material.dto';
import { CompleteProductionDto } from './dto/complete-production.dto';
import { UpdateManufacturingConfigDto } from './dto/update-manufacturing-config.dto';
import { ManufacturingReportsQueryDto } from './dto/manufacturing-reports-query.dto';

@Controller('api/v1/manufacturing')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ManufacturingController {
  constructor(
    private readonly bomsService: BomsService,
    private readonly ordersService: ProductionOrdersService,
    private readonly executionService: ProductionExecutionService,
    private readonly configService: ManufacturingConfigService,
    private readonly reportsService: ManufacturingReportsService,
  ) {}

  // ---------------------------------------------------------------------------
  // BILL OF MATERIALS (BOM)
  // ---------------------------------------------------------------------------

  @Post('boms')
  @RequirePermissions('manufacturing.boms.manage')
  async createBom(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateBomDto,
  ) {
    return this.bomsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get('boms')
  @RequirePermissions('manufacturing.boms.view')
  async findAllBoms(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: BomQueryDto,
  ) {
    return this.bomsService.findAll(tenant.organizationId, query);
  }

  @Get('boms/:id')
  @RequirePermissions('manufacturing.boms.view')
  async findOneBom(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bomsService.findOne(tenant.organizationId, id);
  }

  @Patch('boms/:id')
  @RequirePermissions('manufacturing.boms.manage')
  async updateBom(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateBomDto,
  ) {
    return this.bomsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('boms/:id')
  @RequirePermissions('manufacturing.boms.manage')
  async deleteBom(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bomsService.delete(tenant.organizationId, id, tenant.userId);
  }

  @Post('boms/:id/activate')
  @RequirePermissions('manufacturing.boms.activate')
  async activateBom(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bomsService.activate(tenant.organizationId, id, tenant.userId);
  }

  @Post('boms/:id/deactivate')
  @RequirePermissions('manufacturing.boms.activate')
  async deactivateBom(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.bomsService.deactivate(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  // ---------------------------------------------------------------------------
  // PRODUCTION ORDERS
  // ---------------------------------------------------------------------------

  @Post('orders')
  @RequirePermissions('manufacturing.orders.manage')
  async createOrder(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProductionOrderDto,
  ) {
    return this.ordersService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get('orders')
  @RequirePermissions('manufacturing.orders.view')
  async findAllOrders(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProductionOrderQueryDto,
  ) {
    return this.ordersService.findAll(tenant.organizationId, query);
  }

  @Get('orders/:id')
  @RequirePermissions('manufacturing.orders.view')
  async findOneOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.findOne(tenant.organizationId, id);
  }

  @Patch('orders/:id')
  @RequirePermissions('manufacturing.orders.manage')
  async updateOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateProductionOrderDto,
  ) {
    return this.ordersService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('orders/:id')
  @RequirePermissions('manufacturing.orders.manage')
  async deleteOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.delete(tenant.organizationId, id);
  }

  @Get('orders/:id/material-availability')
  @RequirePermissions('manufacturing.planning.view')
  async checkMaterialAvailability(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.checkMaterialAvailability(
      tenant.organizationId,
      id,
    );
  }

  @Post('orders/:id/release')
  @RequirePermissions('manufacturing.orders.release')
  async releaseOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.release(tenant.organizationId, id, tenant.userId);
  }

  @Post('orders/:id/start')
  @RequirePermissions('manufacturing.orders.start')
  async startOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.start(tenant.organizationId, id, tenant.userId);
  }

  @Post('orders/:id/issue-material')
  @RequirePermissions('manufacturing.orders.issue')
  async issueMaterial(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: IssueMaterialDto,
  ) {
    return this.executionService.issueMaterial(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('orders/:id/complete')
  @RequirePermissions('manufacturing.orders.complete')
  async completeProduction(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CompleteProductionDto,
  ) {
    return this.executionService.complete(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('orders/:id/cancel')
  @RequirePermissions('manufacturing.orders.cancel')
  async cancelOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.ordersService.cancel(tenant.organizationId, id, tenant.userId);
  }

  @Post('orders/:id/close')
  @RequirePermissions('manufacturing.orders.close')
  async closeOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.executionService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  // ---------------------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------------------

  @Get('configuration')
  @RequirePermissions('manufacturing.configuration.manage')
  async getConfig(@CurrentTenant() tenant: TenantContext) {
    return this.configService.getConfig(tenant.organizationId);
  }

  @Patch('configuration')
  @RequirePermissions('manufacturing.configuration.manage')
  async updateConfig(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateManufacturingConfigDto,
  ) {
    return this.configService.updateConfig(tenant.organizationId, dto);
  }

  // ---------------------------------------------------------------------------
  // REPORTS
  // ---------------------------------------------------------------------------

  @Get('reports/production-summary')
  @RequirePermissions('manufacturing.reports.view')
  async getProductionSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ManufacturingReportsQueryDto,
  ) {
    return this.reportsService.getProductionSummary(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/material-consumption')
  @RequirePermissions('manufacturing.reports.view')
  async getMaterialConsumption(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ManufacturingReportsQueryDto,
  ) {
    return this.reportsService.getMaterialConsumption(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/production-cost')
  @RequirePermissions('manufacturing.costing.view')
  async getProductionCost(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ManufacturingReportsQueryDto,
  ) {
    return this.reportsService.getProductionCost(tenant.organizationId, query);
  }

  @Get('reports/wip')
  @RequirePermissions('manufacturing.costing.view')
  async getWipReport(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getWipReport(tenant.organizationId);
  }

  @Get('reports/production-variance')
  @RequirePermissions('manufacturing.costing.view')
  async getProductionVariance(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ManufacturingReportsQueryDto,
  ) {
    return this.reportsService.getProductionVariance(
      tenant.organizationId,
      query,
    );
  }
}
