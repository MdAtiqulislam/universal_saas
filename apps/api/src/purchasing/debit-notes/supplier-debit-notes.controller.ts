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
  SupplierDebitNotesService,
  SupplierDebitNoteWithDetails,
} from './supplier-debit-notes.service';
import { CreateSupplierDebitNoteDto } from './dto/create-supplier-debit-note.dto';
import { UpdateSupplierDebitNoteDto } from './dto/update-supplier-debit-note.dto';
import { SupplierDebitNoteQueryDto } from './dto/supplier-debit-note-query.dto';
import { ApplySupplierDebitNoteDto } from './dto/apply-supplier-debit-note.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('purchasing/debit-notes')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SupplierDebitNotesController {
  constructor(private readonly debitNotesService: SupplierDebitNotesService) {}

  @Get()
  @RequirePermissions('purchasing.debit-notes.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SupplierDebitNoteQueryDto,
  ) {
    return this.debitNotesService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('purchasing.debit-notes.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSupplierDebitNoteDto,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('purchasing.debit-notes.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('purchasing.debit-notes.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDebitNoteDto,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.update(tenant.organizationId, id, dto);
  }

  @Post(':id/approve')
  @RequirePermissions('purchasing.debit-notes.approve')
  async approve(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.approve(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/post')
  @RequirePermissions('purchasing.debit-notes.post')
  async post(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.post(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Post(':id/apply')
  @RequirePermissions('purchasing.debit-notes.apply')
  async apply(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: ApplySupplierDebitNoteDto,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.apply(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Post(':id/void')
  @RequirePermissions('purchasing.debit-notes.void')
  async void(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ): Promise<SupplierDebitNoteWithDetails> {
    return this.debitNotesService.void(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
