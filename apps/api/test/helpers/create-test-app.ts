import { INestApplication, ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { AppModule } from '../../src/app.module';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';
import { MetricsInterceptor } from '../../src/common/interceptors/metrics.interceptor';
import { TransformInterceptor } from '../../src/common/interceptors/transform.interceptor';
import { MetricsService } from '../../src/infra/metrics/metrics.service';

/**
 * Creates a fully configured NestJS test application that mirrors the
 * production bootstrap (global prefix, pipes, filters, interceptors).
 *
 * Prerequisites — infrastructure must be running before the test suite:
 *   make infra-up          # starts Postgres + Redis
 *   npm run migration:run  # creates tables (first time only)
 *
 * Usage:
 *   const app = await createTestApp();
 *   const dataSource = app.get(DataSource);
 *   // ... tests ...
 *   await app.close();
 */
export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    // Silence NestJS internal logs during tests — change to 'verbose' to debug.
    .setLogger(false as never)
    .compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  app.useGlobalInterceptors(
    new MetricsInterceptor(app.get(MetricsService)),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  await app.init();
  return app;
}
