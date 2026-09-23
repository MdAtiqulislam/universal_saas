import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { IncidentService } from './incident.service';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import { ResolveIncidentDto } from '../dto/resolve-incident.dto';
import { IncidentQueryDto } from '../dto/incident-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permission.guard';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

@Controller('operations/incidents')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class IncidentController {
  constructor(private readonly incidentService: IncidentService) {}

  @Get()
  @RequirePermissions('operations.incidents.view')
  listIncidents(@Query() query: IncidentQueryDto) {
    return this.incidentService.listIncidents(query);
  }

  @Post()
  @RequirePermissions('operations.incidents.manage')
  createIncident(
    @Body() dto: CreateIncidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentService.createIncident(dto, req.user?.id);
  }

  @Get(':id')
  @RequirePermissions('operations.incidents.view')
  getIncident(@Param('id') id: string) {
    return this.incidentService.getIncident(id);
  }

  @Post(':id/acknowledge')
  @RequirePermissions('operations.incidents.manage')
  acknowledgeIncident(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentService.acknowledgeIncident(id, req.user?.id);
  }

  @Post(':id/resolve')
  @RequirePermissions('operations.incidents.manage')
  resolveIncident(
    @Param('id') id: string,
    @Body() dto: ResolveIncidentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.incidentService.resolveIncident(id, dto, req.user?.id);
  }

  @Post(':id/close')
  @RequirePermissions('operations.incidents.manage')
  closeIncident(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.incidentService.closeIncident(id, req.user?.id);
  }
}
