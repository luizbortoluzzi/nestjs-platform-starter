import { Global, Logger, Module } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/config.service';
import { AppCacheService } from './cache.service';
import { REDIS_CLIENT } from './cache.constants';

export { REDIS_CLIENT } from './cache.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService],
      useFactory: (configService: AppConfigService): Redis => {
        const config = configService.getRedisConfig();
        const logger = new Logger('Redis');

        const client = new Redis({
          host: config.host,
          port: config.port,
          password: config.password || undefined,
          // Connect immediately so failures are visible at startup.
          lazyConnect: false,
          enableReadyCheck: true,
          // Fail commands quickly when disconnected rather than queuing
          // indefinitely. Keeps HTTP request latency predictable under failure.
          maxRetriesPerRequest: 3,
          // Exponential backoff capped at 5s. Returning null after 10 attempts
          // stops ioredis from retrying and puts the client in an error state.
          retryStrategy: (times: number): number | null => {
            if (times > 10) {
              logger.error('Max reconnection attempts reached — giving up');
              return null;
            }
            const delay = Math.min(times * 200, 5_000);
            logger.warn(`Reconnecting in ${delay}ms (attempt ${times})`);
            return delay;
          },
        });

        client.on('connect', () => logger.log('Connected'));
        client.on('ready', () => logger.log('Ready'));
        client.on('error', (err: Error) =>
          logger.error(`Error: ${err.message}`),
        );
        client.on('close', () => logger.warn('Connection closed'));
        client.on('reconnecting', () => logger.warn('Reconnecting…'));
        client.on('end', () => logger.warn('Connection ended'));

        return client;
      },
    },
    AppCacheService,
  ],
  exports: [AppCacheService, REDIS_CLIENT],
})
export class AppCacheModule {}
