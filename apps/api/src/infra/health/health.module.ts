import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RedisHealthIndicator } from './indicators/redis.health';

@Module({
  imports: [
    TerminusModule.forRoot({
      // Suppress terminus's own request logging — our LoggingInterceptor
      // already logs all requests uniformly.
      logger: false,
      // Throw errors instead of returning them in a 503 body, so our
      // global HttpExceptionFilter can shape the error envelope consistently.
      errorLogStyle: 'pretty',
    }),
  ],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
