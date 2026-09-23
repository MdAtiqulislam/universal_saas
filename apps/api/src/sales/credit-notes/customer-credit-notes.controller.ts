import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CustomerCreditNotesService,
  CustomerCreditNoteWithDetails,
} from './customer-credit-notes.service';
import { CreateCustomerCreditNoteDto } from './dto/create-customer-credit-note.dto';
import { UpdateCustomerCreditNoteDto } from './dto/update-customer-credit-note.dto';
import { CustomerCreditNoteQueryDto } from './dto/customer-credit-note-query.dto';
import { ApplyCustomerCreditNoteDto } from './dto/apply-customer-credit-note.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('sales/credit-notes')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerCreditNotesController {
  constructor(
    private readonly creditNotesService: CustomerCreditNotesService,
  ) {}

  @Get()
  @RequirePermissions('sales.credit-notes.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: CustomerCreditNoteQueryDto,
  ) {
    return this.creditNotesService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('sales.credit-notes.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCustomerCreditNoteDto,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('sales.credit-notes.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('sales.credit-notes.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerCreditNoteDto,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.update(tenant.organizationId, id, dto);
  }

  @Post(':id/approve')
  @RequirePermissions('sales.credit-notes.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/post')
  @RequirePermissions('sales.credit-notes.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.post(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/apply')
  @RequirePermissions('sales.credit-notes.apply')
  async apply(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ApplyCustomerCreditNoteDto,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.apply(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('sales.credit-notes.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<CustomerCreditNoteWithDetails> {
    return this.creditNotesService.void(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
