import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReturnDispositionService } from './return-disposition.service';
import { CreateReturnDispositionDto } from './dto/create-disposition.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnDispositionController {
  constructor(private readonly dispositionService: ReturnDispositionService) {}

  @Get(':id/dispositions')
  @RequirePermissions('returns.disposition.view')
  async findByReturn(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.dispositionService.findByReturn(tenant.organizationId, id);
  }

  @Post(':id/dispositions')
  @RequirePermissions('returns.disposition.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReturnDispositionDto,
  ) {
    return this.dispositionService.createDispositions(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
