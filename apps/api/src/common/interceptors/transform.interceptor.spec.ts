import { ExecutionContext, CallHandler } from '@nestjs/common';

import { of, lastValueFrom } from 'rxjs';

import { TransformInterceptor } from './transform.interceptor';

function makeContext(reqOverrides = {}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ requestId: 'req-id-1', ...reqOverrides }),
      getResponse: () => ({ statusCode: 200 }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown): CallHandler {
  return { handle: () => of(value) };
}

describe('TransformInterceptor', () => {
  let interceptor: TransformInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new TransformInterceptor();
  });

  it('wraps the handler result in the API envelope', async () => {
    const context = makeContext();
    const result = await lastValueFrom(interceptor.intercept(context, makeHandler({ id: 1 })));

    expect(result.data).toEqual({ id: 1 });
    expect(result.statusCode).toBe(200);
    expect(result.requestId).toBe('req-id-1');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('uses "-" as requestId fallback when req.requestId is absent', async () => {
    const context = makeContext({ requestId: undefined });
    const result = await lastValueFrom(interceptor.intercept(context, makeHandler(null)));

    expect(result.requestId).toBe('-');
  });

  it('preserves null data payloads', async () => {
    const context = makeContext();
    const result = await lastValueFrom(interceptor.intercept(context, makeHandler(null)));

    expect(result.data).toBeNull();
  });
});
