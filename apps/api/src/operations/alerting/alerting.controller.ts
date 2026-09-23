import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AlertingService } from './alerting.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { PermissionGuard } from '../../auth/guards/permission.guard';

interface AuthenticatedRequest {
  user?: {
    id?: string;
    organizationId?: string;
  };
}

@Controller('operations/alerts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class AlertingController {
  constructor(private readonly alertingService: AlertingService) {}

  @Get()
  @RequirePermissions('operations.alerts.view')
  listRules(@Req() req: AuthenticatedRequest) {
    return this.alertingService.listRules(req.user?.organizationId);
  }

  @Post()
  @RequirePermissions('operations.alerts.manage')
  createRule(
    @Body() dto: CreateAlertRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.alertingService.createRule(dto, req.user?.id);
  }

  @Patch(':id')
  @RequirePermissions('operations.alerts.manage')
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateAlertRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.alertingService.updateRule(id, dto, req.user?.id);
  }

  @Get('events')
  @RequirePermissions('operations.alerts.view')
  getActiveAlerts(@Req() req: AuthenticatedRequest) {
    return this.alertingService.getActiveAlerts(req.user?.organizationId);
  }

  @Post('events/:id/acknowledge')
  @RequirePermissions('operations.alerts.manage')
  acknowledgeAlert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.alertingService.acknowledgeAlert(id, req.user?.id);
  }

  @Post('events/:id/resolve')
  @RequirePermissions('operations.alerts.manage')
  resolveAlert(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.alertingService.resolveAlert(id, req.user?.id);
  }
}
