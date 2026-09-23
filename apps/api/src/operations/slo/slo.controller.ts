import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SloService } from './slo.service';
import { CreateSloDto } from '../dto/create-slo.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permission.guard';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

@Controller('operations/slo')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SloController {
  constructor(private readonly sloService: SloService) {}

  @Get()
  @RequirePermissions('operations.slo.view')
  listSlos(@Req() req: AuthenticatedRequest) {
    return this.sloService.listSlos(req.user?.organizationId);
  }

  @Post()
  @RequirePermissions('operations.slo.manage')
  createSlo(@Body() dto: CreateSloDto, @Req() req: AuthenticatedRequest) {
    return this.sloService.createSlo(dto, req.user?.id);
  }

  @Get('compliance')
  @RequirePermissions('operations.slo.view')
  getSloCompliance(@Req() req: AuthenticatedRequest) {
    return this.sloService.getSloCompliance(req.user?.organizationId);
  }

  @Get(':id')
  @RequirePermissions('operations.slo.view')
  getSlo(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.sloService.getSlo(id, req.user?.organizationId);
  }
}
