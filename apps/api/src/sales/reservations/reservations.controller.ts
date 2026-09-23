import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import {
  ReservationsService,
  ReservationWithDetails,
} from './reservations.service';
import { ReservationQueryDto } from './dto/reservation-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('inventory-reservations')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @RequirePermissions('sales.reservations.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ReservationQueryDto,
  ): Promise<{
    reservations: ReservationWithDetails[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.reservationsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('sales.reservations.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationWithDetails> {
    return this.reservationsService.findOne(tenant.organizationId, id);
  }

  @Post(':id/release')
  @RequirePermissions('sales.reservations.release')
  async release(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<ReservationWithDetails> {
    return this.reservationsService.release(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
