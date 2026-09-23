import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { UsageMeteringService } from '../services/usage-metering.service';
import {
  RecordUsageDto,
  UsageQueryDto,
  SetQuotaDto,
} from '../dto/billing-usage.dto';

@Controller('billing/usage')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingUsageController {
  constructor(private readonly usageService: UsageMeteringService) {}

  @Post('record')
  @RequirePermissions('billing.subscription.manage')
  async recordUsage(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: RecordUsageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const result = await this.usageService.recordUsage(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: result,
      message: 'Usage recorded successfully',
    };
  }

  @Get('summary')
  @RequirePermissions('billing.usage.read')
  async getUsageSummary(
    @CurrentTenant() tenant: TenantContext,
    @Query('days') days?: number,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const summary = await this.usageService.getUsageSummary(
      tenant.organizationId,
      days ? Number(days) : 30,
    );
    return {
      success: true,
      data: summary,
      message: 'Usage summary retrieved',
    };
  }

  @Get('records')
  @RequirePermissions('billing.usage.read')
  async listUsageRecords(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: UsageQueryDto,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const records = await this.usageService.listUsageRecords(
      tenant.organizationId,
      query,
    );
    return {
      success: true,
      data: records,
      message: 'Usage records retrieved',
    };
  }

  @Get('quotas')
  @RequirePermissions('billing.usage.read')
  async listQuotas(@CurrentTenant() tenant: TenantContext) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const quotas = await this.usageService.listQuotas(tenant.organizationId);
    return {
      success: true,
      data: quotas,
      message: 'Quotas retrieved',
    };
  }

  @Post('quotas')
  @RequirePermissions('billing.admin')
  async setQuota(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: SetQuotaDto,
    @Req() req: AuthenticatedRequest,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }
    const quota = await this.usageService.setQuota(
      tenant.organizationId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: quota,
      message: 'Quota configured successfully',
    };
  }

  @Get('metrics')
  @RequirePermissions('billing.usage.read')
  async listMetrics() {
    const metrics = await this.usageService.listMetrics();
    return {
      success: true,
      data: metrics,
      message: 'Registered billing metrics retrieved',
    };
  }
}
