import { JwtStrategy } from './jwt.strategy';
import { UserRole } from '../../users/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const mockConfig = {
  getJwtConfig: jest.fn().mockReturnValue({ secret: 'test-secret' }),
};

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  beforeEach(() => {
    strategy = new JwtStrategy(mockConfig as never);
  });

  it('validate returns AuthenticatedUser from the JWT payload', async () => {
    const payload: JwtPayload = { sub: 'user-1', email: 'alice@example.com', role: UserRole.USER };

    const result = await strategy.validate(payload);

    expect(result).toEqual({ id: 'user-1', email: 'alice@example.com', role: UserRole.USER });
  });
});
