import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { of, lastValueFrom } from 'rxjs';

import { IdempotencyInterceptor } from './idempotency.interceptor';

const LOCK = '__PROCESSING__';

function makeContext(
  headers: Record<string, string | undefined>,
  resOverrides = {},
): ExecutionContext {
  const setHeader = jest.fn();
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
      getResponse: () => ({ setHeader, ...resOverrides }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = 'handler-result'): CallHandler {
  return { handle: () => of(value) };
}

describe('IdempotencyInterceptor', () => {
  let cache: { get: jest.Mock; set: jest.Mock; setIfNotExists: jest.Mock };
  let interceptor: IdempotencyInterceptor;

  beforeEach(() => {
    cache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      setIfNotExists: jest.fn(),
    };
    interceptor = new IdempotencyInterceptor(cache as never);
  });

  afterEach(() => jest.clearAllMocks());

  it('passes through when no Idempotency-Key header is present', async () => {
    const context = makeContext({});
    const result = await lastValueFrom(interceptor.intercept(context, makeHandler('data')));
    expect(result).toBe('data');
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an empty Idempotency-Key header', () => {
    const context = makeContext({ 'idempotency-key': '  ' });
    // The interceptor throws synchronously before returning an Observable.
    expect(() => interceptor.intercept(context, makeHandler())).toThrow(BadRequestException);
  });

  it('claims the key, runs the handler, and caches the result on first call', async () => {
    cache.get.mockResolvedValue(null);
    cache.setIfNotExists.mockResolvedValue(true);

    const context = makeContext({ 'idempotency-key': 'key-abc' });
    const result = await lastValueFrom(interceptor.intercept(context, makeHandler('payload')));

    expect(result).toBe('payload');
    expect(cache.setIfNotExists).toHaveBeenCalledWith('idempotency:key-abc', LOCK, 30);
    expect(cache.set).toHaveBeenCalledWith('idempotency:key-abc', 'payload', 86_400);
  });

  it('replays the stored result without invoking the handler on subsequent calls', async () => {
    cache.get.mockResolvedValue('cached-payload');

    const handler = { handle: jest.fn() };
    const context = makeContext({ 'idempotency-key': 'key-abc' });
    const result = await lastValueFrom(
      interceptor.intercept(context, handler as unknown as CallHandler),
    );

    expect(result).toBe('cached-payload');
    expect(handler.handle).not.toHaveBeenCalled();
  });

  it('sets Idempotency-Replayed header when returning a cached response', async () => {
    cache.get.mockResolvedValue('cached-payload');
    const setHeader = jest.fn();
    const context = makeContext({ 'idempotency-key': 'key-abc' }, { setHeader });

    await lastValueFrom(interceptor.intercept(context, makeHandler()));

    expect(setHeader).toHaveBeenCalledWith('Idempotency-Replayed', 'true');
  });

  it('throws ConflictException when request is already in-flight (LOCK_SENTINEL)', async () => {
    cache.get.mockResolvedValue(LOCK);

    const context = makeContext({ 'idempotency-key': 'key-abc' });
    await expect(lastValueFrom(interceptor.intercept(context, makeHandler()))).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws ConflictException when lost the Redis race (setIfNotExists returns false)', async () => {
    cache.get.mockResolvedValue(null);
    cache.setIfNotExists.mockResolvedValue(false);

    const context = makeContext({ 'idempotency-key': 'key-abc' });
    await expect(lastValueFrom(interceptor.intercept(context, makeHandler()))).rejects.toThrow(
      ConflictException,
    );
  });
});
