import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import type { IncomingMessage, ServerResponse } from 'http';

// Health probe paths generate constant traffic and add no signal to the access
// log — suppress them so they don't dilute production log volumes.
const HEALTH_PATH_PREFIX = '/api/v1/health';

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // debug in dev/test, info in production — structured JSON either way.
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',

        // pino-pretty is only enabled when stdout is an interactive TTY (i.e.
        // a developer's terminal running `npm run start:dev`). In Docker,
        // CI, and production the TTY flag is false, so we always emit raw
        // JSON — which log aggregators (Loki, CloudWatch, etc.) expect.
        transport:
          process.stdout.isTTY === true
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
            : undefined,

        // Reuse the X-Request-ID forwarded by load balancers/API gateways, or
        // generate a fresh UUID. Setting the response header here keeps it in
        // sync with req.requestId (set downstream by RequestIdMiddleware).
        genReqId: (req: IncomingMessage, res: ServerResponse) => {
          const existing = req.headers['x-request-id'];
          const id = typeof existing === 'string' && existing ? existing : randomUUID();
          res.setHeader('X-Request-ID', id);
          return id;
        },

        // Trim the serialized req/res objects to what's actually useful.
        // Full request headers and body are never logged — they may contain credentials.
        serializers: {
          req(req) {
            return { id: req.id, method: req.method, url: req.url };
          },
          res(res) {
            return { statusCode: res.statusCode };
          },
        },

        // Suppress health probe access logs — orchestrators ping these every few
        // seconds and the noise makes it hard to spot real traffic.
        autoLogging: {
          ignore: (req: IncomingMessage) =>
            (req.url?.startsWith(HEALTH_PATH_PREFIX) ?? false),
        },
      },
    }),
  ],
})
export class AppLoggerModule {}
