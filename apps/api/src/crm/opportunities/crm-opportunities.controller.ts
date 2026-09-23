import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmOpportunitiesService } from './crm-opportunities.service';
import {
  CreateOpportunityDto,
  UpdateOpportunityDto,
  ChangeOpportunityStageDto,
  CloseOpportunityWonDto,
  CloseOpportunityLostDto,
  OpportunityQueryDto,
} from '../dto/opportunity.dto';
import { CreateOpportunityLineDto } from '../dto/opportunity-line.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/opportunities')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmOpportunitiesController {
  constructor(private readonly opportunitiesService: CrmOpportunitiesService) {}

  @Post()
  @RequirePermissions('crm.opportunities.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateOpportunityDto,
  ) {
    return this.opportunitiesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('crm.opportunities.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: OpportunityQueryDto,
  ) {
    return this.opportunitiesService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('crm.opportunities.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.opportunitiesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('crm.opportunities.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateOpportunityDto,
  ) {
    return this.opportunitiesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/stage')
  @RequirePermissions('crm.opportunities.stage')
  async changeStage(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ChangeOpportunityStageDto,
  ) {
    return this.opportunitiesService.changeStage(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close-won')
  @RequirePermissions('crm.opportunities.close')
  async closeWon(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CloseOpportunityWonDto,
  ) {
    return this.opportunitiesService.closeWon(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close-lost')
  @RequirePermissions('crm.opportunities.close')
  async closeLost(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CloseOpportunityLostDto,
  ) {
    return this.opportunitiesService.closeLost(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/lines')
  @RequirePermissions('crm.opportunities.manage')
  async addLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CreateOpportunityLineDto,
  ) {
    return this.opportunitiesService.addLine(tenant.organizationId, id, dto);
  }

  @Delete(':id/lines/:lineId')
  @RequirePermissions('crm.opportunities.manage')
  async removeLine(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('lineId') lineId: string,
  ) {
    return this.opportunitiesService.removeLine(
      tenant.organizationId,
      id,
      lineId,
    );
  }
}
