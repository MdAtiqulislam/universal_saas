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
import { ServicePartsService } from './service-parts.service';
import {
  AddServicePartRequirementDto,
  ReserveServicePartsDto,
  IssueServicePartsDto,
  ReturnServicePartsDto,
} from '../dto/service-part.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/service/orders/:orderId/parts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ServicePartsController {
  constructor(private readonly servicePartsService: ServicePartsService) {}

  @Get()
  @RequirePermissions('service.parts.view')
  async findByServiceOrder(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.servicePartsService.findByServiceOrder(
      tenant.organizationId,
      orderId,
    );
  }

  @Post()
  @RequirePermissions('service.parts.reserve')
  @HttpCode(HttpStatus.CREATED)
  async addPartRequirement(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AddServicePartRequirementDto,
  ) {
    return this.servicePartsService.addPartRequirement(
      tenant.organizationId,
      orderId,
      dto,
      tenant.userId,
    );
  }

  @Post('reserve')
  @RequirePermissions('service.parts.reserve')
  @HttpCode(HttpStatus.OK)
  async reserveParts(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ReserveServicePartsDto,
  ) {
    return this.servicePartsService.reserveParts(
      tenant.organizationId,
      orderId,
      dto,
      tenant.userId,
    );
  }

  @Post('issue')
  @RequirePermissions('service.parts.issue')
  @HttpCode(HttpStatus.OK)
  async issueParts(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: IssueServicePartsDto,
  ) {
    return this.servicePartsService.issueParts(
      tenant.organizationId,
      orderId,
      dto,
      tenant.userId,
    );
  }

  @Post('return')
  @RequirePermissions('service.parts.return')
  @HttpCode(HttpStatus.OK)
  async returnParts(
    @CurrentTenant() tenant: TenantContext,
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: ReturnServicePartsDto,
  ) {
    return this.servicePartsService.returnParts(
      tenant.organizationId,
      orderId,
      dto,
      tenant.userId,
    );
  }
}
