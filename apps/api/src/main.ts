import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, ClassSerializerInterceptor } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { MetricsInterceptor } from './common/interceptors/metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Silence NestJS's default logger during bootstrap — pino takes over
    // immediately after via app.useLogger() below.
    bufferLogs: true,
  });

  // Replace NestJS's default logger with pino for all internal framework logs
  // (module init, route mapping, lifecycle events, etc.).
  app.useLogger(app.get(Logger));

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
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: true,
    }),
  );

  // ─── Global exception filter ──────────────────────────────
  app.useGlobalFilters(new HttpExceptionFilter());

  // ─── Global interceptors ──────────────────────────────────
  // Execution order (first registered = outermost wrapper):
  //   1. MetricsInterceptor          — times every request, outermost so it
  //                                    captures total latency including all others
  //   2. TransformInterceptor        — wraps data in { data, statusCode, timestamp }
  //   3. ClassSerializerInterceptor  — strips @Exclude() fields from entities
  // HTTP access logging is handled by pino-http (AppLoggerModule).
  app.useGlobalInterceptors(
    new MetricsInterceptor(app.get(MetricsService)),
    new TransformInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  // ─── Graceful shutdown ────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Running on  http://localhost:${port}/api/v1`, 'Bootstrap');
  logger.log(`Health:     http://localhost:${port}/api/v1/health/live`, 'Bootstrap');
  logger.log(`Metrics:    http://localhost:${port}/api/v1/metrics`, 'Bootstrap');
  logger.log(`Env:        ${nodeEnv}`, 'Bootstrap');
}

bootstrap().catch((err) => {
  // At this point pino may not be initialised yet — use process.stderr directly.
  process.stderr.write(
    JSON.stringify({
      level: 'fatal',
      msg: 'Fatal error during bootstrap',
      err: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    }) + '\n',
  );
  process.exit(1);
});
