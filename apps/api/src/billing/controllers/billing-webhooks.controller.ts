import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UseGuards,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { BillingWebhooksService } from '../services/billing-webhooks.service';
import { InboundBillingWebhookDto } from '../dto/billing-webhook.dto';

@Controller('billing/webhooks')
export class BillingWebhooksController {
  constructor(private readonly webhooksService: BillingWebhooksService) {}

  @Post(':provider')
  async receiveWebhook(
    @Param('provider') provider: string,
    @Body() dto: InboundBillingWebhookDto,
    @Headers('x-signature') signature?: string,
  ) {
    const result = await this.webhooksService.handleInboundWebhook(
      provider,
      dto,
      signature,
    );
    return {
      received: true,
      data: result,
    };
  }

  @Get('events')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermissions('billing.admin')
  async listEvents(
    @Query('provider') provider?: string,
    @Query('limit') limit?: number,
  ) {
    const events = await this.webhooksService.listWebhookEvents(
      provider,
      limit ? Number(limit) : 50,
    );
    return {
      success: true,
      data: events,
      message: 'Inbound webhook events retrieved',
    };
  }
}
