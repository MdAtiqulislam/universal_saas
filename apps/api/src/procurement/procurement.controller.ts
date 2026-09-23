import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

import { PurchaseRequisitionsService } from './purchase-requisitions.service';
import { ProcurementPurchaseOrdersService } from './purchase-orders.service';
import { ProcurementGoodsReceiptsService } from './goods-receipts.service';
import { PurchaseReturnsService } from './purchase-returns.service';
import { ProcurementReportsService } from './procurement-reports.service';

import {
  CreatePurchaseRequisitionDto,
  UpdatePurchaseRequisitionDto,
} from './dto/create-requisition.dto';
import { PurchaseRequisitionQueryDto } from './dto/requisition-query.dto';
import {
  CreateProcurementPurchaseOrderDto,
  UpdateProcurementPurchaseOrderDto,
  AcknowledgePurchaseOrderDto,
} from './dto/create-purchase-order.dto';
import { ProcurementPOQueryDto } from './dto/purchase-order-query.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { CreatePurchaseReturnDto } from './dto/create-return.dto';
import { ProcurementReportsQueryDto } from './dto/procurement-reports-query.dto';

@Controller('procurement')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ProcurementController {
  constructor(
    private readonly requisitionsService: PurchaseRequisitionsService,
    private readonly ordersService: ProcurementPurchaseOrdersService,
    private readonly receiptsService: ProcurementGoodsReceiptsService,
    private readonly returnsService: PurchaseReturnsService,
    private readonly reportsService: ProcurementReportsService,
  ) {}

  // --------------------------------------------------------------------------
  // PURCHASE REQUISITIONS
  // --------------------------------------------------------------------------

  @Get('requisitions')
  @RequirePermissions('procurement.requisitions.view')
  async findAllRequisitions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: PurchaseRequisitionQueryDto,
  ) {
    return this.requisitionsService.findAll(tenant.organizationId, query);
  }

  @Post('requisitions')
  @RequirePermissions('procurement.requisitions.manage')
  async createRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePurchaseRequisitionDto,
  ) {
    return this.requisitionsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('requisitions/:id')
  @RequirePermissions('procurement.requisitions.view')
  async findOneRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.findOne(tenant.organizationId, id);
  }

  @Patch('requisitions/:id')
  @RequirePermissions('procurement.requisitions.manage')
  async updateRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseRequisitionDto,
  ) {
    return this.requisitionsService.update(tenant.organizationId, id, dto);
  }

  @Post('requisitions/:id/submit')
  @RequirePermissions('procurement.requisitions.manage')
  async submitRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.submit(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('requisitions/:id/approve')
  @RequirePermissions('procurement.requisitions.approve')
  async approveRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('requisitions/:id/reject')
  @RequirePermissions('procurement.requisitions.approve')
  async rejectRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.reject(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('requisitions/:id/cancel')
  @RequirePermissions('procurement.requisitions.manage')
  async cancelRequisition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('requisitions/:id/convert-to-po')
  @RequirePermissions('procurement.orders.manage')
  async convertToPO(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.requisitionsService.convertToPO(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('planned-orders/:plannedOrderId/convert')
  @RequirePermissions('procurement.requisitions.manage')
  async convertPlannedOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('plannedOrderId', ParseUUIDPipe) plannedOrderId: string,
  ) {
    return this.requisitionsService.convertPlannedOrder(
      tenant.organizationId,
      plannedOrderId,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // PURCHASE ORDERS
  // --------------------------------------------------------------------------

  @Get('purchase-orders')
  @RequirePermissions('procurement.orders.view')
  async findAllOrders(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementPOQueryDto,
  ) {
    return this.ordersService.findAll(tenant.organizationId, query);
  }

  @Post('purchase-orders')
  @RequirePermissions('procurement.orders.manage')
  async createOrder(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateProcurementPurchaseOrderDto,
  ) {
    return this.ordersService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get('purchase-orders/:id')
  @RequirePermissions('procurement.orders.view')
  async findOneOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(tenant.organizationId, id);
  }

  @Patch('purchase-orders/:id')
  @RequirePermissions('procurement.orders.manage')
  async updateOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProcurementPurchaseOrderDto,
  ) {
    return this.ordersService.update(tenant.organizationId, id, dto);
  }

  @Post('purchase-orders/:id/submit')
  @RequirePermissions('procurement.orders.manage')
  async submitOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.submit(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/approve')
  @RequirePermissions('procurement.orders.approve')
  async approveOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.approve(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/reject')
  @RequirePermissions('procurement.orders.approve')
  async rejectOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.reject(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/send')
  @RequirePermissions('procurement.orders.manage')
  async sendOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.send(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/acknowledge')
  @RequirePermissions('procurement.orders.manage')
  async acknowledgeOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgePurchaseOrderDto,
  ) {
    return this.ordersService.acknowledge(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('purchase-orders/:id/cancel')
  @RequirePermissions('procurement.orders.manage')
  async cancelOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.cancel(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/close')
  @RequirePermissions('procurement.orders.manage')
  async closeOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.close(tenant.organizationId, id, tenant.userId);
  }

  @Post('purchase-orders/:id/receive')
  @RequirePermissions('procurement.receipts.manage')
  async receiveOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.receiptsService.receivePurchaseOrder(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // GOODS RECEIPTS
  // --------------------------------------------------------------------------

  @Get('goods-receipts')
  @RequirePermissions('procurement.receipts.view')
  async findAllReceipts(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: any,
  ) {
    return this.receiptsService.findAll(tenant.organizationId, query);
  }

  @Get('goods-receipts/:id')
  @RequirePermissions('procurement.receipts.view')
  async findOneReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.findOne(tenant.organizationId, id);
  }

  @Post('goods-receipts/:id/cancel')
  @RequirePermissions('procurement.receipts.manage')
  async cancelReceipt(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptsService.cancel(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // PURCHASE RETURNS
  // --------------------------------------------------------------------------

  @Get('returns')
  @RequirePermissions('procurement.returns.view')
  async findAllReturns(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: any,
  ) {
    return this.returnsService.findAll(tenant.organizationId, query);
  }

  @Post('returns')
  @RequirePermissions('procurement.returns.manage')
  async createReturn(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePurchaseReturnDto,
  ) {
    return this.returnsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('returns/:id')
  @RequirePermissions('procurement.returns.view')
  async findOneReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.findOne(tenant.organizationId, id);
  }

  @Post('returns/:id/post')
  @RequirePermissions('procurement.returns.manage')
  async postReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post('returns/:id/cancel')
  @RequirePermissions('procurement.returns.manage')
  async cancelReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.cancel(tenant.organizationId, id, tenant.userId);
  }

  // --------------------------------------------------------------------------
  // PROCUREMENT REPORTS
  // --------------------------------------------------------------------------

  @Get('reports/purchase-orders')
  @RequirePermissions('procurement.reports.view')
  async getPurchaseOrderSummary(@CurrentTenant() tenant: TenantContext) {
    return this.reportsService.getPurchaseOrderSummary(tenant.organizationId);
  }

  @Get('reports/open-orders')
  @RequirePermissions('procurement.reports.view')
  async getOpenOrders(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementReportsQueryDto,
  ) {
    return this.reportsService.getOpenOrders(tenant.organizationId, query);
  }

  @Get('reports/supplier-purchases')
  @RequirePermissions('procurement.reports.view')
  async getSupplierPurchases(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementReportsQueryDto,
  ) {
    return this.reportsService.getSupplierPurchases(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/requisitions')
  @RequirePermissions('procurement.reports.view')
  async getRequisitionReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementReportsQueryDto,
  ) {
    return this.reportsService.getRequisitionReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/goods-receipts')
  @RequirePermissions('procurement.reports.view')
  async getGoodsReceiptReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementReportsQueryDto,
  ) {
    return this.reportsService.getGoodsReceiptReport(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/spend')
  @RequirePermissions('procurement.reports.view')
  async getSpendReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ProcurementReportsQueryDto,
  ) {
    return this.reportsService.getSpendReport(tenant.organizationId, query);
  }
}
