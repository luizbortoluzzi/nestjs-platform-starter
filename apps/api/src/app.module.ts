import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule } from './config/config.module';
import { AppLoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { AppCacheModule } from './cache/cache.module';
import { MetricsModule } from './metrics/metrics.module';
import { QueueModule } from './queue/queue.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Infrastructure — order matters: config first, then logger (depends on config env)
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    AppCacheModule,
    MetricsModule,
    QueueModule,

    // Rate limiting — in-memory store per instance.
    // For multi-replica deployments swap the storage for ThrottlerStorageRedisService.
    // Two named throttlers:
    //   default → 100 req / 60 s  (all routes)
    //   auth    →  10 req / 60 s  (applied to login / register via @Throttle)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth',    ttl: 60_000, limit: 10 },
    ]),

    // Domain modules
    UsersModule,
    AuthModule,
    HealthModule,
    ProjectsModule,
  ],
  providers: [
    // ThrottlerGuard runs before JwtAuthGuard so rate limiting applies to
    // unauthenticated requests too (crucial for login / register brute-force
    // protection).
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    // Global JWT guard — all routes are protected by default.
    // Use @Public() decorator to opt routes out of authentication.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Runs before guards, pipes, and interceptors — every request gets an ID.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
