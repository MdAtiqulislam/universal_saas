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
import { NumberingService } from './numbering.service';
import { CreateSequenceDto } from './dto/create-sequence.dto';
import { UpdateSequenceDto } from './dto/update-sequence.dto';

@Controller('numbering-sequences')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class NumberingController {
  constructor(private readonly numberingService: NumberingService) {}

  @Get()
  @RequirePermissions('master-data.numbering.view')
  async list(
    @CurrentTenant() tenant: TenantContext,
    @Query('isActive') isActive?: string,
  ) {
    const filter = {
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    };
    const data = await this.numberingService.findAll(
      tenant.organizationId,
      filter,
    );
    // Convert BigInt to string for JSON serialization
    const serialized = data.map((s) => ({
      ...s,
      nextNumber: s.nextNumber.toString(),
    }));
    return { success: true, data: serialized };
  }

  @Get(':id')
  @RequirePermissions('master-data.numbering.view')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.numberingService.findOne(tenant.organizationId, id);
    return {
      success: true,
      data: {
        ...data,
        nextNumber: data.nextNumber.toString(),
      },
    };
  }

  @Post()
  @RequirePermissions('master-data.numbering.manage')
  async create(
    @Body() dto: CreateSequenceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.numberingService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data: {
        ...data,
        nextNumber: data.nextNumber.toString(),
      },
    };
  }

  @Patch(':id')
  @RequirePermissions('master-data.numbering.manage')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSequenceDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.numberingService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
    return {
      success: true,
      data: {
        ...data,
        nextNumber: data.nextNumber.toString(),
      },
    };
  }

  @Post(':key/next')
  @RequirePermissions('master-data.numbering.generate')
  async generateNext(
    @Param('key') key: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.numberingService.nextNumber(
      tenant.organizationId,
      key,
      tenant.userId,
    );
    return { success: true, data };
  }
}
