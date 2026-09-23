import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JournalsService, JournalWithDetails } from './journals.service';
import { AccountingPostingService } from '../posting/accounting-posting.service';
import { CreateJournalEntryDto } from './dto/create-journal.dto';
import { UpdateJournalEntryDto } from './dto/update-journal.dto';
import { JournalQueryDto } from './dto/journal-query.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { JournalEntry } from '@prisma/client';

@Controller('accounting/journals')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class JournalsController {
  constructor(
    private readonly journalsService: JournalsService,
    private readonly postingService: AccountingPostingService,
  ) {}

  @Post()
  @RequirePermissions('accounting.journals.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateJournalEntryDto,
  ): Promise<JournalWithDetails> {
    return this.journalsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('accounting.journals.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: JournalQueryDto,
  ): Promise<{
    journals: JournalEntry[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.journalsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('accounting.journals.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<JournalWithDetails> {
    return this.journalsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('accounting.journals.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateJournalEntryDto,
  ): Promise<JournalWithDetails> {
    return this.journalsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('accounting.journals.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<{ success: boolean }> {
    return this.journalsService.remove(tenant.organizationId, id);
  }

  @Post(':id/post')
  @RequirePermissions('accounting.journals.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<JournalWithDetails> {
    return this.postingService.post(tenant.organizationId, id, tenant.userId);
  }

  @Post(':id/reverse')
  @RequirePermissions('accounting.journals.reverse')
  async reverse(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<JournalWithDetails> {
    return this.journalsService.reverse(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
