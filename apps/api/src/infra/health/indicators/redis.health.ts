import { Injectable, Inject } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';

import Redis from 'ioredis';

import { REDIS_CLIENT } from '../../cache/cache.constants';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const reply = await this.redis.ping();
      const isHealthy = reply === 'PONG';
      const status = this.getStatus(key, isHealthy);

      if (isHealthy) return status;

      // ping returned something other than PONG — still a health failure
      throw new HealthCheckError('Redis ping returned unexpected reply', status);
    } catch (err) {
      // Re-throw HealthCheckError as-is so terminus can process it correctly.
      // Wrapping it again would lose the structured indicator payload.
      if (err instanceof HealthCheckError) throw err;

      throw new HealthCheckError(
        'Redis unreachable',
        this.getStatus(key, false, {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }
}
