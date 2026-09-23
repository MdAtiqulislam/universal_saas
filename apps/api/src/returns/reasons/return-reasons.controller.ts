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
import { ReturnReasonsService } from './return-reasons.service';
import {
  CreateReturnReasonDto,
  UpdateReturnReasonDto,
  QueryReturnReasonDto,
} from './dto/return-reason.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns/reasons')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnReasonsController {
  constructor(private readonly reasonsService: ReturnReasonsService) {}

  @Get()
  @RequirePermissions('returns.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryReturnReasonDto,
  ) {
    return this.reasonsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('returns.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reasonsService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('returns.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateReturnReasonDto,
  ) {
    return this.reasonsService.create(
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
    @Body() dto: UpdateReturnReasonDto,
  ) {
    return this.reasonsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
