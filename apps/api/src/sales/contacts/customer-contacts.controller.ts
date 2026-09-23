import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CustomerContactsService } from './customer-contacts.service';
import { CreateCustomerContactDto } from './dto/create-contact.dto';
import { UpdateCustomerContactDto } from './dto/update-contact.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../../auth/guards/permission.guard';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../../organizations/interfaces/tenant-context.interface';
import { CustomerContact } from '@prisma/client';

@Controller('customers/:customerId/contacts')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class CustomerContactsController {
  constructor(
    private readonly customerContactsService: CustomerContactsService,
  ) {}

  @Post()
  @RequirePermissions('sales.customers.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Body() dto: CreateCustomerContactDto,
  ): Promise<CustomerContact> {
    return this.customerContactsService.create(
      tenant.organizationId,
      customerId,
      dto,
      tenant.userId,
    );
  }

  @Get()
  @RequirePermissions('sales.customers.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
  ): Promise<{ contacts: CustomerContact[] }> {
    const contacts = await this.customerContactsService.findAll(
      tenant.organizationId,
      customerId,
    );
    return { contacts };
  }

  @Patch(':contactId')
  @RequirePermissions('sales.customers.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateCustomerContactDto,
  ): Promise<CustomerContact> {
    return this.customerContactsService.update(
      tenant.organizationId,
      customerId,
      contactId,
      dto,
      tenant.userId,
    );
  }

  @Delete(':contactId')
  @RequirePermissions('sales.customers.manage')
  async remove(
    @CurrentTenant() tenant: TenantContext,
    @Param('customerId') customerId: string,
    @Param('contactId') contactId: string,
  ): Promise<{ success: boolean }> {
    return this.customerContactsService.remove(
      tenant.organizationId,
      customerId,
      contactId,
      tenant.userId,
    );
  }
}
