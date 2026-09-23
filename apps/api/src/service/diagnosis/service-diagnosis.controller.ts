import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ServiceDiagnosisService } from './service-diagnosis.service';
import { RecordDiagnosisDto } from '../dto/service-diagnosis.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/tickets/:ticketId/diagnosis')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServiceDiagnosisController {
  constructor(
    private readonly serviceDiagnosisService: ServiceDiagnosisService,
  ) {}

  @Get()
  @RequirePermissions('service.tickets.view')
  async findByTicket(
    @CurrentTenant() tenant: TenantContext,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
  ) {
    return this.serviceDiagnosisService.findByTicket(
      tenant.organizationId,
      ticketId,
    );
  }

  @Post()
  @RequirePermissions('service.tickets.diagnose')
  @HttpCode(HttpStatus.CREATED)
  async recordDiagnosis(
    @CurrentTenant() tenant: TenantContext,
    @Param('ticketId', ParseUUIDPipe) ticketId: string,
    @Body() dto: RecordDiagnosisDto,
  ) {
    return this.serviceDiagnosisService.recordDiagnosis(
      tenant.organizationId,
      ticketId,
      dto,
      tenant.userId,
    );
  }

  @Post(':diagnosisId/finalize')
  @RequirePermissions('service.tickets.diagnose')
  @HttpCode(HttpStatus.OK)
  async finalizeDiagnosis(
    @CurrentTenant() tenant: TenantContext,
    @Param('diagnosisId', ParseUUIDPipe) diagnosisId: string,
  ) {
    return this.serviceDiagnosisService.finalizeDiagnosis(
      tenant.organizationId,
      diagnosisId,
      tenant.userId,
    );
  }
}
