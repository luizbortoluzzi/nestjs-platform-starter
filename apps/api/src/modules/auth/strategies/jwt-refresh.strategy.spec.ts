import { JwtRefreshStrategy } from './jwt-refresh.strategy';
import { Request } from 'express';
import { JwtRefreshPayload } from '../interfaces/jwt-payload.interface';

const mockConfig = {
  getJwtConfig: jest.fn().mockReturnValue({ refreshSecret: 'refresh-secret' }),
};

function makeRequest(authHeader: string): Request {
  return { headers: { authorization: authHeader } } as unknown as Request;
}

describe('JwtRefreshStrategy', () => {
  let strategy: JwtRefreshStrategy;

  beforeEach(() => {
    strategy = new JwtRefreshStrategy(mockConfig as never);
  });

  it('validate extracts userId and refreshToken from the request', async () => {
    const request = makeRequest('Bearer my-refresh-token');
    const payload: JwtRefreshPayload = { sub: 'user-1' };

    const result = await strategy.validate(request, payload);

    expect(result).toEqual({ userId: 'user-1', refreshToken: 'my-refresh-token' });
  });

  it('handles missing Authorization header gracefully', async () => {
    const request = makeRequest('');
    const payload: JwtRefreshPayload = { sub: 'user-2' };

    const result = await strategy.validate(request, payload);

    expect(result).toEqual({ userId: 'user-2', refreshToken: '' });
  });
});
