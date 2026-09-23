import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { IntegrationProvidersService } from './integration-providers.service';
import { ProviderQueryDto } from './dto/provider-query.dto';

@Controller('integrations/providers')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IntegrationProvidersController {
  constructor(private readonly service: IntegrationProvidersService) {}

  @Get()
  @RequirePermissions('integrations.providers.view')
  listProviders(@Query() query: ProviderQueryDto) {
    return this.service.listProviders(query);
  }

  @Get(':id')
  @RequirePermissions('integrations.providers.view')
  getProvider(@Param('id') id: string) {
    return this.service.getProvider(id);
  }
}
