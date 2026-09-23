import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmQuotationsService } from './crm-quotations.service';
import {
  SubmitQuotationDto,
  ApproveQuotationDto,
  RejectQuotationDto,
  AcceptQuotationDto,
  VoidQuotationDto,
} from '../dto/quotation-approval.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/quotations')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmQuotationsController {
  constructor(private readonly quotationsService: CrmQuotationsService) {}

  @Get()
  @RequirePermissions('crm.quotations.view')
  async findAll(@CurrentTenant() tenant: TenantContext, @Query() query: any) {
    return this.quotationsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('crm.quotations.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.quotationsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/submit')
  @RequirePermissions('crm.quotations.submit')
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: SubmitQuotationDto,
  ) {
    return this.quotationsService.submit(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/approve')
  @RequirePermissions('crm.quotations.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ApproveQuotationDto,
  ) {
    return this.quotationsService.approve(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/reject')
  @RequirePermissions('crm.quotations.approve')
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectQuotationDto,
  ) {
    return this.quotationsService.reject(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/send')
  @RequirePermissions('crm.quotations.send')
  async send(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.quotationsService.send(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/accept')
  @RequirePermissions('crm.quotations.accept')
  async accept(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: AcceptQuotationDto,
  ) {
    return this.quotationsService.accept(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/convert')
  @RequirePermissions('crm.quotations.convert')
  async convert(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.quotationsService.convert(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('crm.quotations.manage')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: VoidQuotationDto,
  ) {
    return this.quotationsService.void(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
