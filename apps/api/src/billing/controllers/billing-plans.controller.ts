import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { BillingPlansService } from '../services/billing-plans.service';
import {
  CreateBillingPlanDto,
  CreatePlanVersionDto,
  PublishPlanVersionDto,
} from '../dto/billing-plan.dto';

@Controller('billing/plans')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class BillingPlansController {
  constructor(private readonly plansService: BillingPlansService) {}

  @Get()
  @RequirePermissions('billing.plans.read')
  async listPlans() {
    const plans = await this.plansService.listPlans();
    return {
      success: true,
      data: plans,
      message: 'Billing plans retrieved',
    };
  }

  @Get(':id')
  @RequirePermissions('billing.plans.read')
  async getPlan(@Param('id') id: string) {
    const plan = await this.plansService.getPlan(id);
    return {
      success: true,
      data: plan,
      message: 'Billing plan retrieved',
    };
  }

  @Post()
  @RequirePermissions('billing.plans.manage')
  async createPlan(
    @Body() dto: CreateBillingPlanDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const plan = await this.plansService.createPlan(dto, req.user?.id);
    return {
      success: true,
      data: plan,
      message: 'Billing plan created',
    };
  }

  @Post(':id/versions')
  @RequirePermissions('billing.plans.manage')
  async createVersion(
    @Param('id') id: string,
    @Body() dto: CreatePlanVersionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const version = await this.plansService.createVersion(
      id,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: version,
      message: 'Billing plan version created',
    };
  }

  @Post(':id/versions/:versionId/publish')
  @RequirePermissions('billing.plans.manage')
  async publishVersion(
    @Param('versionId') versionId: string,
    @Body() dto: PublishPlanVersionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const published = await this.plansService.publishVersion(
      versionId,
      dto,
      req.user?.id,
    );
    return {
      success: true,
      data: published,
      message: 'Billing plan version published and sealed',
    };
  }
}
