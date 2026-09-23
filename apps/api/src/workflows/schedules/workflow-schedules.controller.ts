import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WorkflowSchedulesService } from './workflow-schedules.service';
import {
  CreateScheduleDto,
  UpdateScheduleDto,
} from './dto/create-schedule.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('workflow-schedules')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WorkflowSchedulesController {
  constructor(private readonly service: WorkflowSchedulesService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      ((req.headers && req.headers['x-organization-id']) as string);
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('workflows.schedules.view')
  listSchedules(
    @Req() req: OrgRequest,
    @Query('workflowDefinitionId') workflowDefinitionId?: string,
  ) {
    return this.service.listSchedules(this.getOrgId(req), workflowDefinitionId);
  }

  @Post()
  @RequirePermissions('workflows.schedules.manage')
  createSchedule(
    @Req() req: OrgRequest,
    @Query('workflowDefinitionId') workflowDefinitionId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.service.createSchedule(
      this.getOrgId(req),
      workflowDefinitionId,
      dto,
      req.user.id,
    );
  }

  @Patch(':id')
  @RequirePermissions('workflows.schedules.manage')
  updateSchedule(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.updateSchedule(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }

  @Post(':id/run-now')
  @RequirePermissions('workflows.schedules.manage')
  runNow(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.runScheduleNow(this.getOrgId(req), id, req.user.id);
  }
}
