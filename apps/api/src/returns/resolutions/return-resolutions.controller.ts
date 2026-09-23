import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReturnFinancialResolutionService } from './return-financial-resolution.service';
import {
  CreateCreditNoteResolutionDto,
  CreateRefundResolutionDto,
  CreateDebitNoteResolutionDto,
  CreateReplacementResolutionDto,
} from './dto/return-resolution.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnResolutionsController {
  constructor(
    private readonly resolutionsService: ReturnFinancialResolutionService,
  ) {}

  @Get(':id/resolutions')
  @RequirePermissions('returns.view')
  async findResolutions(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.resolutionsService.findResolutions(tenant.organizationId, id);
  }

  @Post(':id/credit-note')
  @RequirePermissions('returns.credit-note')
  async createCreditNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCreditNoteResolutionDto,
  ) {
    return this.resolutionsService.createCreditNoteResolution(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/refund')
  @RequirePermissions('returns.refund')
  async createRefund(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateRefundResolutionDto,
  ) {
    return this.resolutionsService.createRefundResolution(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/debit-note')
  @RequirePermissions('returns.debit-note')
  async createDebitNote(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDebitNoteResolutionDto,
  ) {
    return this.resolutionsService.createDebitNoteResolution(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/replacement')
  @RequirePermissions('returns.replace')
  async createReplacement(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReplacementResolutionDto,
  ) {
    return this.resolutionsService.createReplacementResolution(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
