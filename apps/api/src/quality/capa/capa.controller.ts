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
import { CapaService } from './capa.service';
import {
  CreateCapaDto,
  UpdateCapaDto,
  VerifyCapaDto,
  QueryCapaDto,
} from './dto/capa.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/quality/capa')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CapaController {
  constructor(private readonly capaService: CapaService) {}

  @Get()
  @RequirePermissions('quality.capa.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: QueryCapaDto,
  ) {
    return this.capaService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('quality.capa.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.capaService.findOne(tenant.organizationId, id);
  }

  @Post()
  @RequirePermissions('quality.capa.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCapaDto,
  ) {
    return this.capaService.create(tenant.organizationId, dto, tenant.userId);
  }

  @Patch(':id')
  @RequirePermissions('quality.capa.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCapaDto,
  ) {
    return this.capaService.update(tenant.organizationId, id, dto);
  }

  @Post(':id/start')
  @RequirePermissions('quality.capa.manage')
  async start(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.capaService.start(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/verify')
  @RequirePermissions('quality.capa.verify')
  async verify(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyCapaDto,
  ) {
    return this.capaService.verify(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/close')
  @RequirePermissions('quality.capa.close')
  async close(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.capaService.close(tenant.organizationId, id, tenant.userId);
  }
}
