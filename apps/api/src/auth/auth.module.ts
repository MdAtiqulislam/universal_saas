import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './guards/permission.guard';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret:
          process.env.JWT_SECRET ||
          'dev-jwt-secret-key-universal-saas-m02-32-chars-min',
        signOptions: {
          expiresIn: '15m',
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, AuthorizationService, PermissionGuard],
  exports: [
    AuthService,
    JwtAuthGuard,
    JwtModule,
    AuthorizationService,
    PermissionGuard,
  ],
})
export class AuthModule {}
