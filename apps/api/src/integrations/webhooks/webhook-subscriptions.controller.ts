import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { WebhookSubscriptionsService } from './webhook-subscriptions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

interface OrgRequest extends AuthenticatedRequest {
  organizationId?: string;
  user: {
    id: string;
    sessionId: string;
    organizationId?: string;
  };
}

@Controller('integrations/webhooks')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class WebhookSubscriptionsController {
  constructor(private readonly service: WebhookSubscriptionsService) {}

  private getOrgId(req: OrgRequest): string {
    const orgId =
      req.user.organizationId ||
      req.organizationId ||
      (req.headers && (req.headers['x-organization-id'] as string));
    if (orgId) return orgId;
    throw new Error('Organization context not found in request');
  }

  @Get()
  @RequirePermissions('integrations.webhooks.view')
  listSubscriptions(@Req() req: OrgRequest) {
    return this.service.listSubscriptions(this.getOrgId(req));
  }

  @Get(':id')
  @RequirePermissions('integrations.webhooks.view')
  getSubscription(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.getSubscription(this.getOrgId(req), id);
  }

  @Post()
  @RequirePermissions('integrations.webhooks.manage')
  createSubscription(
    @Req() req: OrgRequest,
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.service.createSubscription(
      this.getOrgId(req),
      dto,
      req.user.id,
    );
  }

  @Put(':id')
  @RequirePermissions('integrations.webhooks.manage')
  updateSubscription(
    @Req() req: OrgRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.service.updateSubscription(
      this.getOrgId(req),
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @RequirePermissions('integrations.webhooks.manage')
  deleteSubscription(@Req() req: OrgRequest, @Param('id') id: string) {
    return this.service.deleteSubscription(this.getOrgId(req), id, req.user.id);
  }
}
