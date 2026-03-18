import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { CommonModule } from '../../common/common.module';
import { AppConfigService } from '../../config/config.service';
import { QueueModule } from '../../infra/queue/queue.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    QueueModule,
    PassportModule,
    // JwtModule is configured for access token signing.
    // Refresh tokens are signed manually in AuthService with a separate secret.
    JwtModule.registerAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const jwt = configService.getJwtConfig();
        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessExpiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    JwtRefreshStrategy,
    LocalStrategy,
    JwtAuthGuard,
    JwtRefreshGuard,
    LocalAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
