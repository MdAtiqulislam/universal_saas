import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceLaborService } from './service-labor.service';
import {
  RecordServiceLaborDto,
  UpdateServiceLaborDto,
} from '../dto/service-labor.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/orders/:orderId/labor')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceLaborController {
  constructor(private readonly serviceLaborService: ServiceLaborService) {}

  @Get()
  @RequirePermissions('service.labor.view')
  async findByServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.serviceLaborService.findByServiceOrder(
      tenant.organizationId,
      orderId,
    );
  }

  @Post()
  @RequirePermissions('service.labor.manage')
  @HttpCode(HttpStatus.CREATED)
  async recordLabor(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordServiceLaborDto,
  ) {
    return this.serviceLaborService.recordLabor(
      tenant.organizationId,
      orderId,
      dto,
      tenant.userId,
    );
  }

  @Patch(':laborId')
  @RequirePermissions('service.labor.manage')
  async updateLabor(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('laborId', ParseUUIDPipe) laborId: string,
    @Body() dto: UpdateServiceLaborDto,
  ) {
    return this.serviceLaborService.updateLabor(
      tenant.organizationId,
      orderId,
      laborId,
      dto,
      tenant.userId,
    );
  }

  @Post(':laborId/finalize')
  @RequirePermissions('service.labor.manage')
  @HttpCode(HttpStatus.OK)
  async finalizeLabor(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('laborId', ParseUUIDPipe) laborId: string,
  ) {
    return this.serviceLaborService.finalizeLabor(
      tenant.organizationId,
      orderId,
      laborId,
      tenant.userId,
    );
  }
}
