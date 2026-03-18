import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { AppConfigModule } from './config/config.module';
import { AppLoggerModule } from './logger/logger.module';
import { DatabaseModule } from './database/database.module';
import { AppCacheModule } from './cache/cache.module';
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
    QueueModule,

    // Domain modules
    UsersModule,
    AuthModule,
    HealthModule,
    ProjectsModule,
  ],
  providers: [
    // Global JWT guard — all routes are protected by default.
    // Use @Public() decorator to opt routes out of authentication.
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Runs before guards, pipes, and interceptors — every request gets an ID.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
