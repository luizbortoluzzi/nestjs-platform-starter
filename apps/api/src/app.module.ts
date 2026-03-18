import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AppConfigModule } from './config/config.module';
import { AppLoggerModule } from './infra/logger/logger.module';
import { DatabaseModule } from './infra/database/database.module';
import { AppCacheModule } from './infra/cache/cache.module';
import { MetricsModule } from './infra/metrics/metrics.module';
import { QueueModule } from './infra/queue/queue.module';
import { HealthModule } from './infra/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
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
    HealthModule,

    // Rate limiting — in-memory store per instance.
    // For multi-replica deployments swap the storage for ThrottlerStorageRedisService.
    // Two named throttlers:
    //   default → 100 req / 60 s  (all routes)
    //   auth    →  10 req / 60 s  (applied to login / register via @Throttle)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 100 },
      { name: 'auth', ttl: 60_000, limit: 10 },
    ]),

    // Domain modules
    UsersModule,
    AuthModule,
    ProjectsModule,
  ],
  providers: [
    // ─── Exception filter ──────────────────────────────────────────────────────
    // Registered via APP_FILTER so it participates in DI and can receive
    // injected dependencies (logger, config, etc.) if needed in the future.
    { provide: APP_FILTER, useClass: HttpExceptionFilter },

    // ─── Interceptors ──────────────────────────────────────────────────────────
    // Execution order: first declared = outermost wrapper around the handler.
    //   1. MetricsInterceptor         — times every request, outermost so it
    //                                   captures total latency including all others
    //   2. TransformInterceptor       — wraps data in { data, statusCode, timestamp }
    //   3. ClassSerializerInterceptor — strips @Exclude() fields from entities
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },

    // ─── Guards ────────────────────────────────────────────────────────────────
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
