import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Authentication token required');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException(
        'Invalid or expired authentication token',
      );
    }

    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException('Malformed authentication token claims');
    }

    // Resolve user from database
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or has been deleted');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('User account is inactive or suspended');
    }

    // Resolve session from database
    const session = await this.prisma.session.findFirst({
      where: {
        id: payload.sid,
        userId: user.id,
      },
    });

    if (!session || session.revokedAt !== null) {
      throw new UnauthorizedException(
        'Session has been revoked or does not exist',
      );
    }

    if (session.expiresAt <= new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    // Attach verified user context to request
    (request as AuthenticatedRequest).user = {
      id: user.id,
      sessionId: session.id,
    };

    return true;
  }

  private extractTokenFromHeader(request: Request): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' && token ? token : null;
  }
}
