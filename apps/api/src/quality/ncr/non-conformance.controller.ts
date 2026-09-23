import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { NonConformanceService } from './non-conformance.service';
import {
  CreateNonConformanceDto,
  ContainNonConformanceDto,
  InvestigateNonConformanceDto,
  DispositionNonConformanceDto,
  CloseNonConformanceDto,
  QueryNonConformanceDto,
} from './dto/non-conformance.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/non-conformances')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class NonConformanceController {
  constructor(private readonly ncrService: NonConformanceService) {}

  @Get()
  @RequirePermissions('quality.non-conformance.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryNonConformanceDto,
  ) {
    return this.ncrService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.non-conformance.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ncrService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.non-conformance.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateNonConformanceDto,
  ) {
    return this.ncrService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Post(':id/contain')
  @RequirePermissions('quality.non-conformance.contain')
  async contain(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ContainNonConformanceDto,
  ) {
    return this.ncrService.contain(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/investigate')
  @RequirePermissions('quality.non-conformance.manage')
  async investigate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvestigateNonConformanceDto,
  ) {
    return this.ncrService.investigate(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/disposition')
  @RequirePermissions('quality.non-conformance.disposition')
  async disposition(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DispositionNonConformanceDto,
  ) {
    return this.ncrService.disposition(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('quality.non-conformance.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseNonConformanceDto,
  ) {
    return this.ncrService.close(tenant.organizationId, id, dto, tenant.userId);
  }
}
