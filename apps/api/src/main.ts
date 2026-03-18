import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger, ClassSerializerInterceptor } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

const logger = new Logger('Bootstrap');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(AppConfigService);
  const { port, nodeEnv, corsOrigins } = configService.getAppConfig();

  // ─── Global prefix ────────────────────────────────────────
  app.setGlobalPrefix('api/v1');

  // ─── CORS ─────────────────────────────────────────────────
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    // Expose X-Request-ID so browser clients can read the correlation ID from
    // responses and include it in support tickets or client-side error reports.
    exposedHeaders: ['X-Request-ID'],
  });

  // ─── Global validation ────────────────────────────────────
  // whitelist: strips properties not in the DTO
  // forbidNonWhitelisted: returns 400 instead of silently stripping
  // transform: coerces primitives (e.g. query param strings → numbers)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown properties from the DTO
      forbidNonWhitelisted: true, // reject requests that send unknown properties
      transform: true,            // coerce primitives (query strings → numbers, etc.)
      stopAtFirstError: true,     // return one message per failing field; keeps
                                  // validation error arrays concise and actionable
    }),
  );

  // ─── Global exception filter ──────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global interceptors ──────────────────────────────────
  // Execution order on the response path (innermost → outermost):
  //   1. ClassSerializerInterceptor — strips @Exclude() fields from entities
  //   2. TransformInterceptor        — wraps data in { data, statusCode, timestamp }
  //   3. LoggingInterceptor          — logs method, path, status, duration
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // ─── Graceful shutdown ────────────────────────────────────
  // Registers SIGTERM/SIGINT handlers via NestJS lifecycle hooks
  // (OnApplicationShutdown). Allows TypeORM, Redis, and BullMQ workers
  // to drain before the process exits — required for zero-downtime deploys.
  app.enableShutdownHooks();

  await app.listen(port);

  logger.log(`Running on  http://localhost:${port}/api/v1`);
  logger.log(`Health:     http://localhost:${port}/api/v1/health`);
  logger.log(`Env:        ${nodeEnv}`);
}

bootstrap().catch((err) => {
  logger.error(
    'Fatal error during bootstrap',
    err instanceof Error ? err.stack : String(err),
  );
  process.exit(1);
});
