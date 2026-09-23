import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service';
import {
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  TriageServiceRequestDto,
  QueryServiceRequestDto,
} from '../dto/service-request.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/requests')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceRequestsController {
  constructor(
    private readonly serviceRequestsService: ServiceRequestsService,
  ) {}

  @Get()
  @RequirePermissions('service.requests.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryServiceRequestDto,
  ) {
    return this.serviceRequestsService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('service.requests.manage')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateServiceRequestDto,
  ) {
    return this.serviceRequestsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('service.requests.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.serviceRequestsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('service.requests.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateServiceRequestDto,
  ) {
    return this.serviceRequestsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/triage')
  @RequirePermissions('service.requests.triage')
  @HttpCode(HttpStatus.OK)
  async triage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TriageServiceRequestDto,
  ) {
    return this.serviceRequestsService.triage(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('service.requests.manage')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
  ) {
    return this.serviceRequestsService.cancel(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }
}
