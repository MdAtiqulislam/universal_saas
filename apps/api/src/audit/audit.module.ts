import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditService } from './audit.service';
import { AuditSanitizerService } from './audit-sanitizer.service';
import { AuditQueryService } from './audit-query.service';
import { AuditEventListener } from './audit-event.listener';
import { AuditController } from './audit.controller';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    AuditSanitizerService,
    AuditQueryService,
    AuditEventListener,
  ],
  exports: [AuditService, AuditSanitizerService, AuditQueryService],
})
export class AuditModule {}
