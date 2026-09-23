import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  FiscalPeriodsService,
  FiscalPeriodWithDetails,
} from './fiscal-periods.service';
import { CreateFiscalPeriodDto } from './dto/create-period.dto';
import { ReopenPeriodDto } from './dto/reopen-period.dto';
import { FiscalPeriodQueryDto } from './dto/period-query.dto';
import { PeriodCloseExecutionSummary } from './period-close-engine.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { FiscalPeriod, PeriodCloseRun, PeriodCloseCheck } from '@prisma/client';

@Controller('accounting/fiscal-periods')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class FiscalPeriodsController {
  constructor(private readonly fiscalPeriodsService: FiscalPeriodsService) {}

  @Post()
  @RequirePermissions('accounting.periods.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateFiscalPeriodDto,
  ): Promise<FiscalPeriod> {
    return this.fiscalPeriodsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('accounting.periods.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FiscalPeriodQueryDto,
  ): Promise<{
    periods: FiscalPeriod[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.fiscalPeriodsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('accounting.periods.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<FiscalPeriodWithDetails> {
    return this.fiscalPeriodsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/start-close')
  @RequirePermissions('accounting.periods.close')
  async startClose(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<FiscalPeriodWithDetails> {
    return this.fiscalPeriodsService.startClose(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/validate-close')
  @RequirePermissions('accounting.periods.view')
  async validateClose(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PeriodCloseExecutionSummary> {
    return this.fiscalPeriodsService.validateClose(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('accounting.periods.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<FiscalPeriodWithDetails> {
    return this.fiscalPeriodsService.close(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/reopen')
  @RequirePermissions('accounting.periods.reopen')
  async reopen(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ReopenPeriodDto,
  ): Promise<FiscalPeriodWithDetails> {
    return this.fiscalPeriodsService.reopen(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Get(':id/close-runs')
  @RequirePermissions('accounting.periods.view')
  async getCloseRuns(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<PeriodCloseRun[]> {
    return this.fiscalPeriodsService.getCloseRuns(tenant.organizationId, id);
  }

  @Get('close-runs/:runId/checks')
  @RequirePermissions('accounting.periods.view')
  async getCloseChecks(
    @CurrentTenant() tenant: TenantContext,
    @Param('runId') runId: string,
  ): Promise<PeriodCloseCheck[]> {
    return this.fiscalPeriodsService.getCloseChecks(
      tenant.organizationId,
      runId,
    );
  }
}
