import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

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

  // ─── OpenAPI / Swagger ────────────────────────────────────
  // Enabled in development only — no docs endpoint in production.
  // Access at: http://localhost:<port>/docs
  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('NestJS Platform Starter')
      .setDescription(
        'Platform API — authentication, user management, project CRUD.\n\n' +
          'Authenticate via **POST /api/v1/auth/login**, copy the `accessToken`, ' +
          'and click **Authorize** to use protected endpoints.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Access token from /auth/login or /auth/register',
        },
        'access-token',
      )
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  // ─── Graceful shutdown ────────────────────────────────────
  app.enableShutdownHooks();

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Running on  http://localhost:${port}/api/v1`, 'Bootstrap');
  logger.log(`Health:     http://localhost:${port}/api/v1/health/live`, 'Bootstrap');
  logger.log(`Metrics:    http://localhost:${port}/api/v1/metrics`, 'Bootstrap');
  if (nodeEnv !== 'production') {
    logger.log(`Docs:       http://localhost:${port}/docs`, 'Bootstrap');
  }
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
