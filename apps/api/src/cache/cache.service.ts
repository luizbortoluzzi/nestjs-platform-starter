import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './cache.constants';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class AppCacheService {
  private readonly defaultTtl: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly configService: AppConfigService,
  ) {
    this.defaultTtl = this.configService.getRedisConfig().ttl;
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);
    if (value === null) return null;
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Store a value with an optional TTL (in seconds).
   * Omitting ttlSeconds uses the REDIS_TTL env var as the default.
   * Pass ttlSeconds = 0 to persist without expiry (use deliberately).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    const ttl = ttlSeconds ?? this.defaultTtl;

    if (ttl === 0) {
      await this.redis.set(key, serialized);
    } else {
      await this.redis.setex(key, ttl, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const count = await this.redis.exists(key);
    return count > 0;
  }

  /**
   * Returns remaining TTL in seconds.
   * -1 = key exists with no expiry. -2 = key does not exist.
   */
  async ttl(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * SET key value NX EX ttlSeconds — atomic "set only if absent".
   * Returns true if the key was set (i.e. did not previously exist),
   * false if the key already existed (no-op).
   */
  async setIfNotExists(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const serialized = JSON.stringify(value);
    const result = await this.redis.set(key, serialized, 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Flushes the entire database.
   * For test teardown only — never call this in production application code.
   */
  async reset(): Promise<void> {
    await this.redis.flushdb();
  }
}
