import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { ApiContractService } from '../services/api-contract.service';
import { ApiExplorerService } from '../services/api-explorer.service';
import { ApiExplorerRequestDto } from '../dto/api-explorer-request.dto';

@Controller('developer/api')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DeveloperApiController {
  constructor(
    private readonly contractService: ApiContractService,
    private readonly explorerService: ApiExplorerService,
  ) {}

  @Get('endpoints')
  @RequirePermissions('developer.api.view')
  listEndpoints(@Query('category') category?: string) {
    const data = this.contractService.listEndpoints(category);
    return {
      success: true,
      data,
      total: data.length,
    };
  }

  @Get('endpoints/:id')
  @RequirePermissions('developer.api.view')
  getEndpointDetail(@Param('id') id: string) {
    const data = this.contractService.getEndpointById(id);
    return {
      success: true,
      data,
    };
  }

  @Post('explorer')
  @RequirePermissions('developer.api.explorer')
  async executeExplorer(
    @CurrentTenant() tenant: TenantContext | undefined,
    @Body() dto: ApiExplorerRequestDto,
  ) {
    if (!tenant?.organizationId) {
      throw new ForbiddenException('Tenant context required');
    }

    const data = await this.explorerService.executeRequest(
      tenant.organizationId,
      tenant.userId || 'developer-user',
      dto,
    );

    return {
      success: true,
      data,
      message: 'API Explorer execution completed',
    };
  }
}
