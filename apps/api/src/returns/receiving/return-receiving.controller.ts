import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReturnReceivingService } from './return-receiving.service';
import { ReceiveReturnDto } from './dto/receive-return.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/returns')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class ReturnReceivingController {
  constructor(private readonly receivingService: ReturnReceivingService) {}

  @Post(':id/receive')
  @RequirePermissions('returns.receive')
  async receive(
    @CurrentTenant() tenant: TenantContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveReturnDto,
  ) {
    return this.receivingService.receiveReturn(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }
}
