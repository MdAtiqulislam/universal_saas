import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { MembershipsService } from './memberships.service';
import { OrganizationSettingsService } from './organization-settings.service';
import { TenantContextGuard } from './guards/tenant-context.guard';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    MembershipsService,
    OrganizationSettingsService,
    TenantContextGuard,
  ],
  exports: [
    OrganizationsService,
    MembershipsService,
    OrganizationSettingsService,
    TenantContextGuard,
  ],
})
export class OrganizationsModule {}
