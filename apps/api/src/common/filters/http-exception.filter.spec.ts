import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

import { QueryFailedError } from 'typeorm';

import { HttpExceptionFilter } from './http-exception.filter';

function makeHost(reqOverrides = {}): ArgumentsHost {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return {
    switchToHttp: () => ({
      getResponse: () => ({ status, json }),
      getRequest: () => ({
        method: 'GET',
        url: '/api/v1/test',
        requestId: 'req-id-1',
        startTime: Date.now() - 100,
        ...reqOverrides,
      }),
    }),
  } as unknown as ArgumentsHost;
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
  });

  it('handles HttpException with string response', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();

    filter.catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), host);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: 'Not Found' }),
    );
  });

  it('handles HttpException with object response (validation error)', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();
    const exception = new HttpException(
      { statusCode: 400, error: 'Bad Request', message: ['field must not be empty'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, message: ['field must not be empty'] }),
    );
  });

  it('maps QueryFailedError with unique violation code to 409', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();
    const dbError = Object.assign(new QueryFailedError('SELECT', [], new Error()), {
      code: '23505',
    });

    filter.catch(dbError, host);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps QueryFailedError with FK violation code to 409', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();
    const dbError = Object.assign(new QueryFailedError('SELECT', [], new Error()), {
      code: '23503',
    });

    filter.catch(dbError, host);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('maps unknown QueryFailedError to 500 without exposing DB details', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();
    const dbError = Object.assign(new QueryFailedError('SELECT', [], new Error()), {
      code: '12345',
    });

    filter.catch(dbError, host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' }),
    );
  });

  it('maps unknown exceptions to 500', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();

    filter.catch(new Error('unexpected'), host);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('includes requestId, timestamp, and path in the response', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();

    filter.catch(new HttpException('Bad Request', 400), host);

    const body = res.json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.requestId).toBe('req-id-1');
    expect(body.path).toBe('/api/v1/test');
    expect(body.timestamp).toBeDefined();
  });
});
