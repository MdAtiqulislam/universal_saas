import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceEstimatesService } from './service-estimates.service';
import {
  CreateServiceEstimateDto,
  ApproveEstimateDto,
  RejectEstimateDto,
} from '../dto/service-estimate.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceEstimatesController {
  constructor(
    private readonly serviceEstimatesService: ServiceEstimatesService,
  ) {}

  @Post('tickets/:ticketId/estimate')
  @RequirePermissions('service.estimates.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: CreateServiceEstimateDto,
  ) {
    dto.serviceTicketId = ticketId;
    return this.serviceEstimatesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('estimates/:id')
  @RequirePermissions('service.estimates.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceEstimatesService.findOne(tenant.organizationId, id);
  }

  @Post('estimates/:id/send')
  @RequirePermissions('service.estimates.manage')
  @HttpCode(HttpStatus.OK)
  async send(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceEstimatesService.send(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('estimates/:id/approve')
  @RequirePermissions('service.estimates.approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveEstimateDto,
  ) {
    return this.serviceEstimatesService.approve(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post('estimates/:id/reject')
  @RequirePermissions('service.estimates.approve')
  @HttpCode(HttpStatus.OK)
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectEstimateDto,
  ) {
    return this.serviceEstimatesService.reject(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
