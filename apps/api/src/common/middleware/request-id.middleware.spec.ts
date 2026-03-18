import { Request, Response, NextFunction } from 'express';

import { RequestIdMiddleware } from './request-id.middleware';

const makeReq = (overrides: Partial<Request> = {}): Request =>
  ({
    headers: {},
    ...overrides,
  }) as unknown as Request;

const noop: NextFunction = () => {};

describe('RequestIdMiddleware', () => {
  let middleware: RequestIdMiddleware;

  beforeEach(() => {
    middleware = new RequestIdMiddleware();
  });

  it('uses pino req.id when present', () => {
    const req = makeReq({ headers: {} });
    (req as unknown as { id: string }).id = 'pino-id-123';

    middleware.use(req, {} as Response, noop);

    expect(req.requestId).toBe('pino-id-123');
  });

  it('falls back to x-request-id header when pino id is absent', () => {
    const req = makeReq({ headers: { 'x-request-id': 'header-id-456' } });

    middleware.use(req, {} as Response, noop);

    expect(req.requestId).toBe('header-id-456');
  });

  it('generates a UUID when no pino id or header is present', () => {
    const req = makeReq();

    middleware.use(req, {} as Response, noop);

    expect(req.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('sets req.startTime to approximately the current timestamp', () => {
    const req = makeReq();
    const before = Date.now();

    middleware.use(req, {} as Response, noop);

    expect(req.startTime).toBeGreaterThanOrEqual(before);
    expect(req.startTime).toBeLessThanOrEqual(Date.now());
  });

  it('calls next()', () => {
    const req = makeReq();
    const next = jest.fn();

    middleware.use(req, {} as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
