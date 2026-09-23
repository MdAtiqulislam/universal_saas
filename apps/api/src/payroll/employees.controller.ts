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
import { EmployeesService } from './employees.service';
import { CompensationService } from './compensation.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeeQueryDto } from './dto/employee-query.dto';
import { CreateCompensationDto } from './dto/create-compensation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantContextGuard } from '../organizations/guards/tenant-context.guard';
import { PermissionGuard } from '../auth/guards/permission.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CurrentTenant } from '../organizations/decorators/current-tenant.decorator';
import type { TenantContext } from '../organizations/interfaces/tenant-context.interface';

@Controller('hr/employees')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class EmployeesController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly compensationService: CompensationService,
  ) {}

  @Get()
  @RequirePermissions('hr.employees.view')
  async findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() query: EmployeeQueryDto,
  ) {
    return this.employeesService.findAll(tenant.organizationId, query);
  }

  @Post()
  @RequirePermissions('hr.employees.manage')
  async create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.employeesService.create(
      tenant.organizationId,
      dto,
      tenant.userId,
    );
  }

  @Get(':id')
  @RequirePermissions('hr.employees.view')
  async findOne(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.employeesService.findOne(tenant.organizationId, id);
  }

  @Patch(':id')
  @RequirePermissions('hr.employees.manage')
  async update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employeesService.update(
      tenant.organizationId,
      id,
      dto,
      tenant.userId,
    );
  }

  @Delete(':id')
  @RequirePermissions('hr.employees.manage')
  async delete(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.employeesService.delete(
      tenant.organizationId,
      id,
      tenant.userId,
    );
  }

  @Get(':id/compensation')
  @RequirePermissions('payroll.reports.sensitive')
  async findCompensation(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.compensationService.findByEmployee(tenant.organizationId, id);
  }

  @Post(':id/compensation')
  @RequirePermissions('hr.employees.manage')
  async addCompensation(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: Omit<CreateCompensationDto, 'employeeId'>,
  ) {
    return this.compensationService.create(
      tenant.organizationId,
      { ...dto, employeeId: id },
      tenant.userId,
    );
  }
}
