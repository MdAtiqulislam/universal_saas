import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReturnRequestsService } from './return-requests.service';
import {
  CreateReturnRequestDto,
  UpdateReturnRequestDto,
  ReviewReturnDto,
  AuthorizeReturnDto,
  RejectReturnDto,
  QueryReturnRequestDto,
} from './dto/return-request.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnRequestsController {
  constructor(private readonly returnsService: ReturnRequestsService) {}

  @Get()
  @RequirePermissions('returns.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryReturnRequestDto,
  ) {
    return this.returnsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('returns.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('returns.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateReturnRequestDto,
  ) {
    return this.returnsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Patch(':id')
  @RequirePermissions('returns.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReturnRequestDto,
  ) {
    return this.returnsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/submit')
  @RequirePermissions('returns.submit')
  async submit(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.submit(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/review')
  @RequirePermissions('returns.review')
  async review(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewReturnDto,
  ) {
    return this.returnsService.review(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/authorize')
  @RequirePermissions('returns.authorize')
  async authorize(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthorizeReturnDto,
  ) {
    return this.returnsService.authorize(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/reject')
  @RequirePermissions('returns.reject')
  async reject(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectReturnDto,
  ) {
    return this.returnsService.reject(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/cancel')
  @RequirePermissions('returns.cancel')
  async cancel(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.returnsService.cancel(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('returns.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason?: string,
  ) {
    return this.returnsService.void(
      tenant.organizationId,
      id,
      reason,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('returns.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.returnsService.close(tenant.organizationId, id, tenant.userId);
  }
}
