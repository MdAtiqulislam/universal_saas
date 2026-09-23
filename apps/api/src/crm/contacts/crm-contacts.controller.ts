import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CrmContactsService } from './crm-contacts.service';
import {
  CreateCrmContactDto,
  UpdateCrmContactDto,
  ContactQueryDto,
} from '../dto/contact.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';

@Controller('api/v1/crm/contacts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CrmContactsController {
  constructor(private readonly contactsService: CrmContactsService) {}

  @Post()
  @RequirePermissions('crm.contacts.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCrmContactDto,
  ) {
    return this.contactsService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('crm.contacts.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: ContactQueryDto,
  ) {
    return this.contactsService.findAll(tenant.organizationId, query);
  }

  @Get(':id')
  @RequirePermissions('crm.contacts.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.contactsService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('crm.contacts.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCrmContactDto,
  ) {
    return this.contactsService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('crm.contacts.manage')
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.contactsService.delete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }
}
