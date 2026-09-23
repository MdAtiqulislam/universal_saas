import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  AuthTokensDto,
  SanitizedUserDto,
} from './dto/auth-response.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Access token lifetime: 15 minutes (900 seconds)
  private readonly accessTokenExpiresIn = 900;
  // Refresh token lifetime: 7 days in milliseconds
  private readonly refreshTokenTtlMs = 7 * 24 * 60 * 60 * 1000;

  // Dummy hash used to mitigate timing attacks on non-existent users
  private readonly dummyHash =
    '$argon2id$v=19$m=65536,t=3,p=4$QAR1q0Na4GXyxl0LWD37JQ$mIXf/CnLpXs7mMm2S56xq7owQNoJez35HjKhmrOgCr4';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly eventBus: EventBusService,
  ) {}

  /**
   * Register a new global user identity.
   */
  async register(dto: RegisterDto): Promise<SanitizedUserDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    // Check for existing active user
    const existing = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    try {
      const user = await this.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          status: 'ACTIVE',
        },
      });

      // Publish authentication event (global, no organizationId)
      await this.eventBus.publish({
        eventName: 'USER_REGISTERED',
        occurredAt: new Date(),
        userId: user.id,
        email: user.email,
      });

      return {
        id: user.id,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email is already registered');
      }
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Failed to register user', errMsg);
      throw error;
    }
  }

  /**
   * Authenticate user credentials and issue access + refresh tokens.
   */
  async login(
    dto: LoginDto,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const normalizedEmail = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: { email: normalizedEmail, deletedAt: null },
    });

    if (!user) {
      // Run dummy verify to mitigate timing attacks
      await argon2.verify(this.dummyHash, dto.password).catch(() => false);
      await this.eventBus.publish({
        eventName: 'LOGIN_FAILED',
        occurredAt: new Date(),
        email: normalizedEmail,
        reason: 'User not found',
        ipAddress: ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!isPasswordValid) {
      await this.eventBus.publish({
        eventName: 'LOGIN_FAILED',
        occurredAt: new Date(),
        userId: user.id,
        email: user.email,
        reason: 'Invalid password',
        ipAddress: ipAddress ?? null,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      await this.eventBus.publish({
        eventName: 'LOGIN_FAILED',
        occurredAt: new Date(),
        userId: user.id,
        email: user.email,
        reason: 'Account inactive',
        ipAddress: ipAddress ?? null,
      });
      throw new UnauthorizedException('Account is inactive or suspended');
    }

    // Generate cryptographic refresh token (320 bits entropy)
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    // Create active session
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash,
        ipAddress: ipAddress ?? null,
        userAgent: userAgent ?? null,
        expiresAt,
      },
    });

    // Sign minimal JWT access token (sub, sid)
    const accessToken = this.generateAccessToken(user.id, session.id);

    // Publish login success event
    await this.eventBus.publish({
      eventName: 'LOGIN_SUCCESS',
      occurredAt: new Date(),
      userId: user.id,
      sessionId: session.id,
      ipAddress: ipAddress ?? null,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: this.accessTokenExpiresIn,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Rotate refresh token and issue new token pair.
   * Includes replay detection and immediate session revocation.
   */
  async refresh(rawRefreshToken: string): Promise<AuthTokensDto> {
    if (!rawRefreshToken || typeof rawRefreshToken !== 'string') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const incomingHash = this.hashToken(rawRefreshToken);

    // Find session matching this token hash
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: incomingHash },
      include: { user: true },
    });

    if (!session) {
      await this.eventBus.publish({
        eventName: 'REFRESH_TOKEN_REPLAY_DETECTED',
        occurredAt: new Date(),
        reason: 'Hash not matched to active session',
      });
      throw new UnauthorizedException('Invalid or revoked refresh token');
    }

    // Verify session validity
    if (session.revokedAt !== null) {
      await this.eventBus.publish({
        eventName: 'REFRESH_TOKEN_REPLAY_DETECTED',
        occurredAt: new Date(),
        userId: session.userId,
        sessionId: session.id,
        reason: 'Revoked session reuse attempt',
      });
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    // Verify user validity
    if (session.user.deletedAt !== null || session.user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    // Generate NEW refresh token (Token Rotation)
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newRefreshTokenHash = this.hashToken(newRawRefreshToken);
    const newExpiresAt = new Date(Date.now() + this.refreshTokenTtlMs);

    // Atomically update session with new refresh token hash
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newRefreshTokenHash,
        expiresAt: newExpiresAt,
      },
    });

    // Generate new access token for the active session
    const accessToken = this.generateAccessToken(session.user.id, session.id);

    await this.eventBus.publish({
      eventName: 'REFRESH_TOKEN_ROTATED',
      occurredAt: new Date(),
      userId: session.userId,
      sessionId: session.id,
    });

    return {
      accessToken,
      refreshToken: newRawRefreshToken,
      expiresIn: this.accessTokenExpiresIn,
    };
  }

  /**
   * Revoke current session (Logout).
   */
  async logout(
    sessionId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!sessionId) {
      throw new UnauthorizedException('Session identifier missing');
    }

    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.eventBus.publish({
      eventName: 'LOGOUT',
      occurredAt: new Date(),
      sessionId,
    });

    return {
      success: true,
      message: 'Logged out successfully',
    };
  }

  /**
   * Revoke all active sessions for a user (Logout All).
   */
  async logoutAll(
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    if (!userId) {
      throw new UnauthorizedException('User identifier missing');
    }

    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await this.eventBus.publish({
      eventName: 'LOGOUT_ALL',
      occurredAt: new Date(),
      userId,
    });

    return {
      success: true,
      message: 'All sessions revoked successfully',
    };
  }

  /**
   * Retrieve safe authenticated user profile.
   */
  async getProfile(userId: string): Promise<SanitizedUserDto> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      status: user.status,
      createdAt: user.createdAt,
    };
  }

  /**
   * Helper: Hash token with SHA-256 before database storage.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Helper: Generate minimal JWT access token.
   */
  private generateAccessToken(userId: string, sessionId: string): string {
    const payload: JwtPayload = {
      sub: userId,
      sid: sessionId,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.accessTokenExpiresIn,
    });
  }
}
