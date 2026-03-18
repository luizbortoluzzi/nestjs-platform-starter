import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from './configuration';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<AppConfiguration, true>) {}

  getAppConfig() {
    return this.configService.get('app', { infer: true });
  }

  getDatabaseConfig() {
    return this.configService.get('database', { infer: true });
  }

  getRedisConfig() {
    return this.configService.get('redis', { infer: true });
  }

  getJwtConfig() {
    return this.configService.get('jwt', { infer: true });
  }

  // ─── Environment helpers ───────────────────────────────────────────────────
  // Use these instead of reading NODE_ENV directly so callers are not
  // coupled to raw string comparisons scattered across the codebase.

  get nodeEnv(): string {
    return this.getAppConfig().nodeEnv;
  }

  isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  isTest(): boolean {
    return this.nodeEnv === 'test';
  }
}
