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
import { CustomerQualityService } from './customer-quality.service';
import {
  CreateCustomerQualityIssueDto,
  ResolveCustomerQualityIssueDto,
  QueryCustomerQualityIssuesDto,
} from './dto/quality-analytics.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/customer-issues')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerQualityController {
  constructor(
    private readonly customerQualityService: CustomerQualityService,
  ) {}

  @Get()
  @RequirePermissions('quality.customer-issues.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryCustomerQualityIssuesDto,
  ) {
    return this.customerQualityService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.customer-issues.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.customerQualityService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.customer-issues.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerQualityIssueDto,
  ) {
    return this.customerQualityService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/resolve')
  @RequirePermissions('quality.customer-issues.resolve')
  async resolve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveCustomerQualityIssueDto,
  ) {
    return this.customerQualityService.resolve(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
