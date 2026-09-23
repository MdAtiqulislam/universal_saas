import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { SupplierContactsService } from './supplier-contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('suppliers/:supplierId/contacts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class SupplierContactsController {
  constructor(private readonly contactsService: SupplierContactsService) {}

  @Get()
  @RequirePermissions('purchasing.suppliers.view')
  async list(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.contactsService.findAll(
      tenant.organizationId,
      supplierId,
    );
    return { success: true, data };
  }

  @Post()
  @RequirePermissions('purchasing.suppliers.manage')
  async create(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateContactDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.contactsService.create(
      tenant.organizationId,
      supplierId,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Contact added successfully' };
  }

  @Patch(':contactId')
  @RequirePermissions('purchasing.suppliers.manage')
  async update(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const data = await this.contactsService.update(
      tenant.organizationId,
      supplierId,
      contactId,
      dto,
      tenant.userId,
    );
    return { success: true, data, message: 'Contact updated successfully' };
  }

  @Delete(':contactId')
  @RequirePermissions('purchasing.suppliers.manage')
  async delete(
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const result = await this.contactsService.remove(
      tenant.organizationId,
      supplierId,
      contactId,
      tenant.userId,
    );
    return result;
  }
}
