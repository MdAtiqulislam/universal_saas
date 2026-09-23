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
import { InspectionLotsService } from './inspection-lots.service';
import {
  CreateInspectionLotDto,
  RecordInspectionResultsDto,
  MakeInspectionDecisionDto,
  QueryInspectionLotsDto,
} from './dto/inspection-lot.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/inspection-lots')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class InspectionLotsController {
  constructor(private readonly lotsService: InspectionLotsService) {}

  @Get()
  @RequirePermissions('quality.inspections.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryInspectionLotsDto,
  ) {
    return this.lotsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.inspections.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.lotsService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.inspections.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateInspectionLotDto,
  ) {
    return this.lotsService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Post(':id/results')
  @RequirePermissions('quality.inspections.execute')
  async recordResults(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordInspectionResultsDto,
  ) {
    return this.lotsService.recordResults(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/decide')
  @RequirePermissions('quality.inspections.decide')
  async decide(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: MakeInspectionDecisionDto,
  ) {
    return this.lotsService.decide(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
