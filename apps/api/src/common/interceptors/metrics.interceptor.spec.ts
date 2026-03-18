import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { lastValueFrom } from 'rxjs';
import { MetricsInterceptor } from './metrics.interceptor';

function makeContext(path: string, method = 'GET', routePath?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ path, method, route: routePath ? { path: routePath } : undefined }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = null): CallHandler {
  return { handle: () => of(value) };
}

describe('MetricsInterceptor', () => {
  let metricsService: {
    httpRequestDuration: { startTimer: jest.Mock };
    httpRequestsTotal: { inc: jest.Mock };
  };
  let endTimer: jest.Mock;
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    endTimer = jest.fn();
    metricsService = {
      httpRequestDuration: { startTimer: jest.fn().mockReturnValue(endTimer) },
      httpRequestsTotal: { inc: jest.fn() },
    };
    interceptor = new MetricsInterceptor(metricsService as never);
  });

  it('skips metrics for /metrics path', async () => {
    const context = makeContext('/api/v1/metrics');
    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(metricsService.httpRequestDuration.startTimer).not.toHaveBeenCalled();
  });

  it('starts a timer and records metrics on completion', async () => {
    const context = makeContext('/api/v1/users', 'GET', '/api/v1/users');
    await lastValueFrom(interceptor.intercept(context, makeHandler('data')));

    expect(metricsService.httpRequestDuration.startTimer).toHaveBeenCalledWith({ method: 'GET' });
    expect(endTimer).toHaveBeenCalledWith({ route: '/api/v1/users', status_code: '200' });
    expect(metricsService.httpRequestsTotal.inc).toHaveBeenCalledWith({
      method: 'GET',
      route: '/api/v1/users',
      status_code: '200',
    });
  });

  it('falls back to req.path when route pattern is not available', async () => {
    const context = makeContext('/api/v1/some-path', 'POST');
    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(endTimer).toHaveBeenCalledWith({ route: '/api/v1/some-path', status_code: '200' });
  });
});
