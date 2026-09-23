import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller()
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  // ----------------------------------------------------------------------------
  // Role Catalog Management
  // ----------------------------------------------------------------------------

  @Get('roles')
  @RequirePermissions('roles.view')
  async listRoles(@CurrentTenant() tenant: TenantContext) {
    const roles = await this.rolesService.listRoles(tenant.organizationId);
    return {
      success: true,
      data: roles,
    };
  }

  @Get('roles/:roleId')
  @RequirePermissions('roles.view')
  async getRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const role = await this.rolesService.getRole(roleId, tenant.organizationId);
    return {
      success: true,
      data: role,
    };
  }

  @Post('roles')
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.CREATED)
  async createRole(
    @Body() dto: CreateRoleDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const role = await this.rolesService.createCustomRole(
      dto,
      tenant.organizationId,
    );
    return {
      success: true,
      data: role,
      message: 'Custom role created successfully',
    };
  }

  @Patch('roles/:roleId')
  @RequirePermissions('roles.manage')
  async updateRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const role = await this.rolesService.updateCustomRole(
      roleId,
      dto,
      tenant.organizationId,
    );
    return {
      success: true,
      data: role,
      message: 'Custom role updated successfully',
    };
  }

  @Delete('roles/:roleId')
  @RequirePermissions('roles.manage')
  async deleteRole(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.rolesService.deleteCustomRole(roleId, tenant.organizationId);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('roles.manage')
  async updateRolePermissions(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRolePermissionsDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const role = await this.rolesService.updateRolePermissions(
      roleId,
      dto.permissions,
      tenant.organizationId,
    );
    return {
      success: true,
      data: role,
      message: 'Role permissions updated successfully',
    };
  }

  // ----------------------------------------------------------------------------
  // Member Role Assignment
  // ----------------------------------------------------------------------------

  @Get('organizations/:id/members/:memberId/roles')
  @RequirePermissions('roles.view')
  async listMemberRoles(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const roles = await this.rolesService.listMemberRoles(
      tenant.organizationId,
      memberId,
    );
    return {
      success: true,
      data: roles,
    };
  }

  @Post('organizations/:id/members/:memberId/roles')
  @RequirePermissions('roles.manage')
  @HttpCode(HttpStatus.CREATED)
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: AssignRoleDto,
    @CurrentTenant() tenant: TenantContext,
  ) {
    const assignment = await this.rolesService.assignRoleToMember(
      tenant.organizationId,
      memberId,
      dto.roleId,
    );
    return {
      success: true,
      data: assignment,
      message: 'Role assigned to member successfully',
    };
  }

  @Delete('organizations/:id/members/:memberId/roles/:roleId')
  @RequirePermissions('roles.manage')
  async removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.rolesService.removeRoleFromMember(
      tenant.organizationId,
      memberId,
      roleId,
    );
  }
}
