import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SerialsService } from './serials.service';
import { CreateSerialDto } from './dto/create-serial.dto';
import { UpdateSerialDto } from './dto/update-serial.dto';
import { SerialStatus } from '@prisma/client';

@Controller('inventory/serials')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SerialsController {
  constructor(private readonly serialsService: SerialsService) {}

  @Get()
  @RequirePermissions('inventory.serials.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('itemId') itemId?: string,
    @Query('locationId') locationId?: string,
    @Query('status') status?: SerialStatus,
    @Query('search') search?: string,
  ) {
    const filter = {
      itemId,
      locationId,
      status,
      search,
    };
    const data = await this.serialsService.findAll(
      tenant.organizationId,
      filter,
    );
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('inventory.serials.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.serialsService.findOne(tenant.organizationId, id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('inventory.serials.manage')
  async create(
    @Body() dto: CreateSerialDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.serialsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('inventory.serials.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSerialDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.serialsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return { success: true, data };
  }
}
