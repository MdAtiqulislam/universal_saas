import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';
import { UpdateSecurityPolicyDto } from '../dto/security-policies.dto';

@Injectable()
export class SecurityPoliciesService {
  private readonly logger = new Logger(SecurityPoliciesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async getPolicy(organizationId: string) {
    let policy = await this.prisma.securityPolicy.findUnique({
      where: { organizationId },
    });

    if (!policy) {
      policy = await this.prisma.securityPolicy.create({
        data: {
          organizationId,
          maxFailedLogins: 5,
          lockoutDurationMinutes: 15,
          sessionLifetimeHours: 24,
          sessionIdleTimeoutMinutes: 60,
          passwordMinLength: 12,
          passwordRequireUppercase: true,
          passwordRequireNumbers: true,
          passwordRequireSymbols: true,
          passwordHistoryRetention: 5,
          apiRateLimitPerMinute: 120,
          mfaEnforced: false,
        },
      });
    }

    return policy;
  }

  async updatePolicy(
    organizationId: string,
    dto: UpdateSecurityPolicyDto,
    actorUserId: string,
  ) {
    const current = await this.getPolicy(organizationId);

    const updated = await this.prisma.securityPolicy.update({
      where: { organizationId },
      data: {
        maxFailedLogins: dto.maxFailedLogins ?? current.maxFailedLogins,
        lockoutDurationMinutes:
          dto.lockoutDurationMinutes ?? current.lockoutDurationMinutes,
        sessionLifetimeHours:
          dto.sessionLifetimeHours ?? current.sessionLifetimeHours,
        sessionIdleTimeoutMinutes:
          dto.sessionIdleTimeoutMinutes ?? current.sessionIdleTimeoutMinutes,
        passwordMinLength: dto.passwordMinLength ?? current.passwordMinLength,
        passwordRequireUppercase:
          dto.passwordRequireUppercase ?? current.passwordRequireUppercase,
        passwordRequireNumbers:
          dto.passwordRequireNumbers ?? current.passwordRequireNumbers,
        passwordRequireSymbols:
          dto.passwordRequireSymbols ?? current.passwordRequireSymbols,
        passwordHistoryRetention:
          dto.passwordHistoryRetention ?? current.passwordHistoryRetention,
        apiRateLimitPerMinute:
          dto.apiRateLimitPerMinute ?? current.apiRateLimitPerMinute,
        mfaEnforced: dto.mfaEnforced ?? current.mfaEnforced,
      },
    });

    await this.eventBus.publish({
      eventName: 'SECURITY_POLICY_CHANGED',
      occurredAt: new Date(),
      organizationId,
      actorUserId,
      changes: dto,
    });

    await this.prisma.securityEvent.create({
      data: {
        organizationId,
        category: 'CONFIGURATION',
        eventType: 'SECURITY_POLICY_CHANGED',
        severity: 'HIGH',
        actorUserId,
        resource: 'security_policy',
        resourceId: updated.id,
        details: { changes: dto as any },
      },
    });

    return updated;
  }
}
