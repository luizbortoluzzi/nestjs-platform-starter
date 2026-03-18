import { Test, TestingModule } from '@nestjs/testing';

import { REDIS_CLIENT } from './cache.constants';
import { AppCacheService } from './cache.service';
import { AppConfigService } from '../../config/config.service';

const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
};

const mockConfig = {
  getRedisConfig: jest.fn().mockReturnValue({ host: 'localhost', port: 6379, ttl: 60 }),
};

describe('AppCacheService', () => {
  let service: AppCacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppCacheService,
        { provide: REDIS_CLIENT, useValue: mockRedis },
        { provide: AppConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(AppCacheService);
  });

  describe('get', () => {
    it('returns null when key does not exist', async () => {
      mockRedis.get.mockResolvedValue(null);
      expect(await service.get('key')).toBeNull();
    });

    it('parses and returns JSON value', async () => {
      mockRedis.get.mockResolvedValue(JSON.stringify({ id: 1 }));
      expect(await service.get('key')).toEqual({ id: 1 });
    });

    it('returns raw string when value is not valid JSON', async () => {
      mockRedis.get.mockResolvedValue('plain-string');
      expect(await service.get<string>('key')).toBe('plain-string');
    });
  });

  describe('set', () => {
    it('uses setex with the given TTL when ttlSeconds is provided', async () => {
      await service.set('key', { val: 1 }, 120);
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 120, JSON.stringify({ val: 1 }));
    });

    it('uses set without expiry when ttlSeconds is 0', async () => {
      await service.set('key', 'data', 0);
      expect(mockRedis.set).toHaveBeenCalledWith('key', '"data"');
    });

    it('uses the default TTL when ttlSeconds is omitted', async () => {
      await service.set('key', 'data');
      expect(mockRedis.setex).toHaveBeenCalledWith('key', 60, '"data"');
    });
  });

  describe('del', () => {
    it('calls redis.del with the key', async () => {
      await service.del('key');
      expect(mockRedis.del).toHaveBeenCalledWith('key');
    });
  });

  describe('exists', () => {
    it('returns true when key exists', async () => {
      mockRedis.exists.mockResolvedValue(1);
      expect(await service.exists('key')).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      mockRedis.exists.mockResolvedValue(0);
      expect(await service.exists('key')).toBe(false);
    });
  });

  describe('ttl', () => {
    it('returns the remaining TTL from redis', async () => {
      mockRedis.ttl.mockResolvedValue(42);
      expect(await service.ttl('key')).toBe(42);
    });
  });

  describe('setIfNotExists', () => {
    it('returns true when the key is newly set', async () => {
      mockRedis.set.mockResolvedValue('OK');
      expect(await service.setIfNotExists('key', 'val', 30)).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith('key', '"val"', 'EX', 30, 'NX');
    });

    it('returns false when the key already exists', async () => {
      mockRedis.set.mockResolvedValue(null);
      expect(await service.setIfNotExists('key', 'val', 30)).toBe(false);
    });
  });
});
