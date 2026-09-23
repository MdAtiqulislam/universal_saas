import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceOrdersService } from './service-orders.service';
import { ServiceQualityIntegrationService } from '../quality/service-quality-integration.service';
import { ServiceBillingIntegrationService } from '../billing/service-billing-integration.service';
import { ServiceHandoverService } from '../handover/service-handover.service';
import {
  CreateServiceOrderDto,
  QueryServiceOrderDto,
} from '../dto/service-order.dto';
import { ProcessServiceHandoverDto } from '../dto/service-handover.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/orders')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceOrdersController {
  constructor(
    private readonly serviceOrdersService: ServiceOrdersService,
    private readonly qualityIntegrationService: ServiceQualityIntegrationService,
    private readonly billingIntegrationService: ServiceBillingIntegrationService,
    private readonly handoverService: ServiceHandoverService,
  ) {}

  @Get()
  @RequirePermissions('service.orders.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryServiceOrderDto,
  ) {
    return this.serviceOrdersService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('service.orders.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateServiceOrderDto,
  ) {
    return this.serviceOrdersService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('service.orders.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.findOne(tenant.organizationId, id);
  }

  @Post(':id/release')
  @RequirePermissions('service.orders.release')
  @HttpCode(HttpStatus.OK)
  async release(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.release(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/start')
  @RequirePermissions('service.orders.execute')
  @HttpCode(HttpStatus.OK)
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.start(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/request-quality-check')
  @RequirePermissions('service.quality.request')
  @HttpCode(HttpStatus.OK)
  async requestQualityCheck(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.qualityIntegrationService.requestQualityCheck(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/complete')
  @RequirePermissions('service.orders.complete')
  @HttpCode(HttpStatus.OK)
  async complete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.complete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/handover')
  @RequirePermissions('service.orders.handover')
  @HttpCode(HttpStatus.OK)
  async handover(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ProcessServiceHandoverDto,
  ) {
    return this.handoverService.processHandover(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/invoice')
  @RequirePermissions('service.billing.invoice')
  @HttpCode(HttpStatus.OK)
  async invoice(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billingIntegrationService.invoiceServiceOrder(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('service.orders.manage')
  @HttpCode(HttpStatus.OK)
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('service.orders.cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceOrdersService.cancel(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
