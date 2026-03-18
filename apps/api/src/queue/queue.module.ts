import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigService } from '../config/config.service';
import { QUEUE_NAMES } from './queue.constants';
import { NotificationProcessor } from './processors/notification.processor';

// Not @Global() — queues are application-level resources, not infrastructure
// singletons. Import QueueModule explicitly in the modules that enqueue jobs.
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService) => {
        const redis = configService.getRedisConfig();
        return {
          // BullMQ manages its own ioredis connection separate from the
          // REDIS_CLIENT used by AppCacheService — this is intentional so
          // queue traffic does not interfere with cache operations.
          connection: {
            host: redis.host,
            port: redis.port,
            password: redis.password || undefined,
            // BullMQ recommends maxRetriesPerRequest: null so job commands
            // wait for reconnect rather than failing immediately.
            maxRetriesPerRequest: null,
          },
          defaultJobOptions: {
            // Retry failed jobs up to 3 times before moving to the failed set.
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1_000, // 1s → 2s → 4s
            },
            // Keep the last 100 completed and 200 failed jobs for inspection.
            // Prevents unbounded Redis memory growth.
            removeOnComplete: 100,
            removeOnFail: 200,
          },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS },
      { name: QUEUE_NAMES.EMAILS },
    ),
  ],
  providers: [NotificationProcessor],
  exports: [BullModule],
})
export class QueueModule {}
