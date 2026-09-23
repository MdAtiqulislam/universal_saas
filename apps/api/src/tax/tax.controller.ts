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
import { TaxService } from './tax.service';
import { CreateTaxJurisdictionDto } from './dto/create-tax-jurisdiction.dto';
import { UpdateTaxJurisdictionDto } from './dto/update-tax-jurisdiction.dto';
import { CreateTaxCodeDto } from './dto/create-tax-code.dto';
import { UpdateTaxCodeDto } from './dto/update-tax-code.dto';
import { CreateEffectiveTaxRateDto } from './dto/create-effective-tax-rate.dto';
import { UpdateEffectiveTaxRateDto } from './dto/update-effective-tax-rate.dto';
import { CreateTaxRuleDto } from './dto/create-tax-rule.dto';
import { UpdateTaxRuleDto } from './dto/update-tax-rule.dto';
import { CalculateTaxDto } from './dto/calculate-tax.dto';
import { CreateTaxPeriodDto } from './dto/create-tax-period.dto';
import { TaxReportQueryDto } from './dto/tax-report-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('tax')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  // --------------------------------------------------------------------------
  // TAX CODES
  // --------------------------------------------------------------------------

  @Get('codes')
  @RequirePermissions('tax.codes.view')
  async findCodes(@CurrentTenant() tenant: TenantContext) {
    return this.taxService.findCodes(tenant.organizationId);
  }

  @Post('codes')
  @RequirePermissions('tax.codes.manage')
  async createCode(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTaxCodeDto,
  ) {
    return this.taxService.createCode(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('codes/:id')
  @RequirePermissions('tax.codes.view')
  async findCode(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.findCode(tenant.organizationId, id);
  }

  @Patch('codes/:id')
  @RequirePermissions('tax.codes.manage')
  async updateCode(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateTaxCodeDto,
  ) {
    return this.taxService.updateCode(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete('codes/:id')
  @RequirePermissions('tax.codes.manage')
  async deleteCode(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.deleteCode(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // TAX RATES
  // --------------------------------------------------------------------------

  @Get('rates')
  @RequirePermissions('tax.rates.view')
  async findRates(
    @CurrentTenant() tenant: TenantContext,
    @Query('taxCodeId') taxCodeId?: string,
  ) {
    return this.taxService.findRates(tenant.organizationId, taxCodeId);
  }

  @Post('rates')
  @RequirePermissions('tax.rates.manage')
  async createRate(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateEffectiveTaxRateDto,
  ) {
    return this.taxService.createRate(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('rates/:id')
  @RequirePermissions('tax.rates.view')
  async findRate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.findRate(tenant.organizationId, id);
  }

  @Patch('rates/:id')
  @RequirePermissions('tax.rates.manage')
  async updateRate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEffectiveTaxRateDto,
  ) {
    return this.taxService.updateRate(tenant.organizationId, id, dto);
  }

  // --------------------------------------------------------------------------
  // TAX JURISDICTIONS
  // --------------------------------------------------------------------------

  @Get('jurisdictions')
  @RequirePermissions('tax.jurisdictions.view')
  async findJurisdictions(@CurrentTenant() tenant: TenantContext) {
    return this.taxService.findJurisdictions(tenant.organizationId);
  }

  @Post('jurisdictions')
  @RequirePermissions('tax.jurisdictions.manage')
  async createJurisdiction(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTaxJurisdictionDto,
  ) {
    return this.taxService.createJurisdiction(tenant.organizationId, dto);
  }

  @Get('jurisdictions/:id')
  @RequirePermissions('tax.jurisdictions.view')
  async findJurisdiction(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.findJurisdiction(tenant.organizationId, id);
  }

  @Patch('jurisdictions/:id')
  @RequirePermissions('tax.jurisdictions.manage')
  async updateJurisdiction(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateTaxJurisdictionDto,
  ) {
    return this.taxService.updateJurisdiction(tenant.organizationId, id, dto);
  }

  // --------------------------------------------------------------------------
  // TAX RULES
  // --------------------------------------------------------------------------

  @Get('rules')
  @RequirePermissions('tax.rules.view')
  async findRules(@CurrentTenant() tenant: TenantContext) {
    return this.taxService.findRules(tenant.organizationId);
  }

  @Post('rules')
  @RequirePermissions('tax.rules.manage')
  async createRule(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTaxRuleDto,
  ) {
    return this.taxService.createRule(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get('rules/:id')
  @RequirePermissions('tax.rules.view')
  async findRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.findRule(tenant.organizationId, id);
  }

  @Patch('rules/:id')
  @RequirePermissions('tax.rules.manage')
  async updateRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateTaxRuleDto,
  ) {
    return this.taxService.updateRule(tenant.organizationId, id, dto);
  }

  @Delete('rules/:id')
  @RequirePermissions('tax.rules.manage')
  async deleteRule(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.deleteRule(tenant.organizationId, id);
  }

  // --------------------------------------------------------------------------
  // TAX CALCULATION
  // --------------------------------------------------------------------------

  @Post('calculate')
  @RequirePermissions('tax.calculation.view')
  async calculateTax(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CalculateTaxDto,
  ) {
    return this.taxService.calculateTax(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  // --------------------------------------------------------------------------
  // TAX REPORTS
  // --------------------------------------------------------------------------

  @Get('reports/summary')
  @RequirePermissions('tax.reports.view')
  async getSummaryReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.getSummaryReport(tenant.organizationId, query);
  }

  @Get('reports/output-tax')
  @RequirePermissions('tax.reports.view')
  async getOutputTaxReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.getOutputTaxReport(tenant.organizationId, query);
  }

  @Get('reports/input-tax')
  @RequirePermissions('tax.reports.view')
  async getInputTaxReport(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.getInputTaxReport(tenant.organizationId, query);
  }

  @Get('reports/by-code')
  @RequirePermissions('tax.reports.view')
  async getReportByCode(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.getReportByCode(tenant.organizationId, query);
  }

  @Get('reports/by-jurisdiction')
  @RequirePermissions('tax.reports.view')
  async getReportByJurisdiction(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.getReportByJurisdiction(
      tenant.organizationId,
      query,
    );
  }

  @Get('reports/transactions')
  @RequirePermissions('tax.reports.view')
  async getTransactions(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: TaxReportQueryDto,
  ) {
    return this.taxService.findTransactions(tenant.organizationId, query);
  }

  // --------------------------------------------------------------------------
  // TAX PERIODS
  // --------------------------------------------------------------------------

  @Get('periods')
  @RequirePermissions('tax.periods.view')
  async findPeriods(@CurrentTenant() tenant: TenantContext) {
    return this.taxService.findPeriods(tenant.organizationId);
  }

  @Post('periods')
  @RequirePermissions('tax.periods.manage')
  async createPeriod(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateTaxPeriodDto,
  ) {
    return this.taxService.createPeriod(tenant.organizationId, dto);
  }

  @Get('periods/:id')
  @RequirePermissions('tax.periods.view')
  async findPeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.findPeriod(tenant.organizationId, id);
  }

  @Post('periods/:id/prepare')
  @RequirePermissions('tax.periods.manage')
  async preparePeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.preparePeriod(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post('periods/:id/lock')
  @RequirePermissions('tax.periods.lock')
  async lockPeriod(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.taxService.lockPeriod(tenant.organizationId, id, tenant.userId);
  }
}
