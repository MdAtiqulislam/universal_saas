import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { OrganizationsService } from './organizations.service';
import { MembershipsService } from './memberships.service';
import { OrganizationSettingsService } from './organization-settings.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateOrganizationSettingsDto } from './dto/update-organization-settings.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly membershipsService: MembershipsService,
    private readonly settingsService: OrganizationSettingsService,
  ) {}

  // ----------------------------------------------------------------------------
  // Organization Core CRUD
  // ----------------------------------------------------------------------------

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.create(dto, req.user.id);
    return {
      success: true,
      data: org,
      message: 'Organization created successfully',
    };
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const orgs = await this.organizationsService.listUserOrganizations(
      req.user.id,
    );
    return {
      success: true,
      data: orgs,
    };
  }

  @Get(':id')
  async get(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.getOrganization(
      id,
      req.user.id,
    );
    return {
      success: true,
      data: org,
    };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const org = await this.organizationsService.updateOrganization(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      data: org,
      message: 'Organization updated successfully',
    };
  }

  @Delete(':id')
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.organizationsService.softDeleteOrganization(id, req.user.id);
  }

  // ----------------------------------------------------------------------------
  // Organization Membership Management
  // ----------------------------------------------------------------------------

  @Get(':id/members')
  async listMembers(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const members = await this.membershipsService.listMembers(id, req.user.id);
    return {
      success: true,
      data: members,
    };
  }

  @Post(':id/members')
  @HttpCode(HttpStatus.CREATED)
  async addMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const member = await this.membershipsService.addMember(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      data: member,
      message: 'Member invited successfully',
    };
  }

  @Patch(':id/members/:memberId')
  async updateMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const member = await this.membershipsService.updateMember(
      id,
      memberId,
      dto,
      req.user.id,
    );
    return {
      success: true,
      data: member,
      message: 'Member updated successfully',
    };
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.membershipsService.removeMember(id, memberId, req.user.id);
  }

  // ----------------------------------------------------------------------------
  // Organization Settings Management
  // ----------------------------------------------------------------------------

  @Get(':id/settings')
  async getSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const settings = await this.settingsService.getSettings(id, req.user.id);
    return {
      success: true,
      data: settings,
    };
  }

  @Patch(':id/settings')
  async updateSettings(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const settings = await this.settingsService.updateSettings(
      id,
      dto,
      req.user.id,
    );
    return {
      success: true,
      data: settings,
      message: 'Organization settings updated successfully',
    };
  }
}
