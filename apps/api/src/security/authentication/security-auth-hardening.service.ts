import {
  Injectable,
  Logger,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EventBusService } from '../../events/event-bus.service';

@Injectable()
export class SecurityAuthHardeningService {
  private readonly logger = new Logger(SecurityAuthHardeningService.name);

  // Default fallback thresholds
  private readonly defaultMaxFailedLogins = 5;
  private readonly defaultLockoutMinutes = 15;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBusService,
  ) {}

  async checkAccountLockout(email: string): Promise<{
    isLocked: boolean;
    lockedUntil?: Date;
    remainingMinutes?: number;
  }> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      return { isLocked: false };
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.max(
        1,
        Math.ceil(remainingMs / (60 * 1000)),
      );
      return {
        isLocked: true,
        lockedUntil: user.lockedUntil,
        remainingMinutes,
      };
    }

    return { isLocked: false };
  }

  async handleFailedLogin(
    email: string,
    organizationId?: string,
    ipAddress?: string,
    userAgent?: string,
    reason: string = 'Invalid credentials',
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    const maxLogins = this.defaultMaxFailedLogins;
    const lockoutMinutes = this.defaultLockoutMinutes;

    if (user) {
      const newFailedCount = user.failedLoginAttempts + 1;
      let lockedUntil: Date | null = null;

      if (newFailedCount >= maxLogins) {
        lockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
        this.logger.warn(
          `User ${normalizedEmail} locked out until ${lockedUntil.toISOString()} after ${newFailedCount} failed attempts`,
        );
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: newFailedCount,
          lockedUntil,
        },
      });

      await this.prisma.loginAttempt.create({
        data: {
          email: normalizedEmail,
          organizationId: organizationId ?? null,
          userId: user.id,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          status: lockedUntil ? 'LOCKED' : 'FAILED',
          failureReason: reason,
        },
      });

      if (lockedUntil) {
        await this.eventBus.publish({
          eventName: 'ACCOUNT_LOCKED',
          occurredAt: new Date(),
          organizationId: organizationId ?? null,
          userId: user.id,
          email: normalizedEmail,
          lockedUntil,
          ipAddress: ipAddress ?? null,
        });

        await this.prisma.securityEvent.create({
          data: {
            organizationId: organizationId ?? null,
            category: 'AUTHENTICATION',
            eventType: 'ACCOUNT_LOCKED',
            severity: 'HIGH',
            actorUserId: user.id,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
            details: { failedAttempts: newFailedCount, lockedUntil },
          },
        });
      }
    } else {
      await this.prisma.loginAttempt.create({
        data: {
          email: normalizedEmail,
          organizationId: organizationId ?? null,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent ?? null,
          status: 'FAILED',
          failureReason: reason,
        },
      });
    }
  }

  async handleSuccessfulLogin(
    userId: string,
    email: string,
    organizationId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    await this.prisma.loginAttempt.create({
      data: {
        email: normalizedEmail,
        organizationId: organizationId ?? null,
        userId,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        status: 'SUCCESS',
      },
    });
  }

  async unlockAccount(
    organizationId: string,
    userId: string,
    actorUserId: string,
  ): Promise<{ success: boolean; message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found.`);
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await this.eventBus.publish({
      eventName: 'ACCOUNT_UNLOCKED',
      occurredAt: new Date(),
      organizationId,
      userId,
      actorUserId,
    });

    await this.prisma.securityEvent.create({
      data: {
        organizationId,
        category: 'AUTHENTICATION',
        eventType: 'ACCOUNT_UNLOCKED',
        severity: 'MEDIUM',
        actorUserId,
        resource: 'user',
        resourceId: userId,
        details: { unlockedBy: actorUserId },
      },
    });

    return {
      success: true,
      message: `Account for user ${user.email} unlocked successfully.`,
    };
  }
}
