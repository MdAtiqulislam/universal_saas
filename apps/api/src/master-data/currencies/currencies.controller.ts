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
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CurrenciesService } from './currencies.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Controller('currencies')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @RequirePermissions('master-data.currencies.view')
  async list(
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
    };
    const data = await this.currenciesService.findAll(filter);
    return { success: true, data };
  }

  @Get(':id')
  @RequirePermissions('master-data.currencies.view')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const data = await this.currenciesService.findOne(id);
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('master-data.currencies.manage')
  async create(
    @Body() dto: CreateCurrencyDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.currenciesService.create(dto, tenant.userId);
    return { success: true, data };
  }

  @Patch(':id')
  @RequirePermissions('master-data.currencies.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurrencyDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.currenciesService.update(id, dto, tenant.userId);
    return { success: true, data };
  }

  @Delete(':id')
  @RequirePermissions('master-data.currencies.manage')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.currenciesService.deactivate(id, tenant.userId);
    return { success: true, message: result.message };
  }
}
