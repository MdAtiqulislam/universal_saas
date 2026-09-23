import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmLeadsService } from './crm-leads.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  QualifyLeadDto,
  ConvertLeadDto,
  CloseLeadDto,
  LeadQueryDto,
} from '../dto/lead.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/leads')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmLeadsController {
  constructor(private readonly leadsService: CrmLeadsService) {}

  @Post()
  @RequirePermissions('crm.leads.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Get()
  @RequirePermissions('crm.leads.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: LeadQueryDto,
  ) {
    return this.leadsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('crm.leads.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.leadsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('crm.leads.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/qualify')
  @RequirePermissions('crm.leads.qualify')
  async qualify(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: QualifyLeadDto,
  ) {
    return this.leadsService.qualify(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/convert')
  @RequirePermissions('crm.leads.convert')
  async convert(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ConvertLeadDto,
  ) {
    return this.leadsService.convert(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('crm.leads.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CloseLeadDto,
  ) {
    return this.leadsService.close(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
