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
import { ServiceTicketsService } from './service-tickets.service';
import {
  CreateServiceTicketDto,
  AssignTechnicianDto,
  QueryServiceTicketDto,
} from '../dto/service-ticket.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/tickets')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceTicketsController {
  constructor(private readonly serviceTicketsService: ServiceTicketsService) {}

  @Get()
  @RequirePermissions('service.tickets.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryServiceTicketDto,
  ) {
    return this.serviceTicketsService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('service.tickets.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateServiceTicketDto,
  ) {
    return this.serviceTicketsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('service.tickets.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceTicketsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/assign')
  @RequirePermissions('service.tickets.assign')
  @HttpCode(HttpStatus.OK)
  async assign(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTechnicianDto,
  ) {
    return this.serviceTicketsService.assign(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/start-diagnosis')
  @RequirePermissions('service.tickets.diagnose')
  @HttpCode(HttpStatus.OK)
  async startDiagnosis(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceTicketsService.startDiagnosis(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/hold')
  @RequirePermissions('service.tickets.manage')
  @HttpCode(HttpStatus.OK)
  async hold(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.serviceTicketsService.hold(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  @Post(':id/resume')
  @RequirePermissions('service.tickets.manage')
  @HttpCode(HttpStatus.OK)
  async resume(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceTicketsService.resume(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
