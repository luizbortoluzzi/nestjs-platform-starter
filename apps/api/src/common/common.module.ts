import { Module } from '@nestjs/common';
import { IdempotencyInterceptor } from './interceptors/idempotency.interceptor';

/**
 * Shared module for cross-cutting application utilities.
 *
 * Import CommonModule in any feature module that needs access to the
 * interceptors or utilities exported here. Because AppCacheModule is @Global(),
 * IdempotencyInterceptor's AppCacheService dependency resolves automatically.
 */
@Module({
  providers: [IdempotencyInterceptor],
  exports: [IdempotencyInterceptor],
})
export class CommonModule {}
