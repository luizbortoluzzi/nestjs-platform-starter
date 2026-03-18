import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppConfigService } from './config.service';

const appConfig = { nodeEnv: 'test', port: 3000, corsOrigins: ['http://localhost'] };
const dbConfig = { host: 'localhost', port: 5432, name: 'db', user: 'u', password: 'p' };
const redisConfig = { host: 'localhost', port: 6379, ttl: 3600 };
const jwtConfig = {
  secret: 's',
  refreshSecret: 'rs',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
};

function configGetMock(key: string) {
  const map: Record<string, unknown> = {
    app: appConfig,
    database: dbConfig,
    redis: redisConfig,
    jwt: jwtConfig,
  };
  return map[key];
}

describe('AppConfigService', () => {
  let service: AppConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppConfigService,
        { provide: ConfigService, useValue: { get: jest.fn(configGetMock) } },
      ],
    }).compile();

    service = module.get(AppConfigService);
  });

  it('getAppConfig returns app configuration', () => {
    expect(service.getAppConfig()).toBe(appConfig);
  });

  it('getDatabaseConfig returns database configuration', () => {
    expect(service.getDatabaseConfig()).toBe(dbConfig);
  });

  it('getRedisConfig returns redis configuration', () => {
    expect(service.getRedisConfig()).toBe(redisConfig);
  });

  it('getJwtConfig returns jwt configuration', () => {
    expect(service.getJwtConfig()).toBe(jwtConfig);
  });

  it('nodeEnv returns app.nodeEnv', () => {
    expect(service.nodeEnv).toBe('test');
  });

  it('isTest() returns true in test environment', () => {
    expect(service.isTest()).toBe(true);
  });

  it('isProduction() returns false in test environment', () => {
    expect(service.isProduction()).toBe(false);
  });

  it('isDevelopment() returns false in test environment', () => {
    expect(service.isDevelopment()).toBe(false);
  });
});
