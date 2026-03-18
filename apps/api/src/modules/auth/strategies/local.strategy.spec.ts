import { UnauthorizedException } from '@nestjs/common';
import { LocalStrategy } from './local.strategy';
import { UserEntity, UserRole } from '../../users/entities/user.entity';

function makeUser(): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'user-1',
    email: 'alice@example.com',
    role: UserRole.USER,
  });
}

describe('LocalStrategy', () => {
  let strategy: LocalStrategy;
  let authService: { validateUser: jest.Mock };

  beforeEach(() => {
    authService = { validateUser: jest.fn() };
    strategy = new LocalStrategy(authService as never);
  });

  it('returns the user when credentials are valid', async () => {
    const user = makeUser();
    authService.validateUser.mockResolvedValue(user);

    const result = await strategy.validate('alice@example.com', 'pass');

    expect(result).toBe(user);
    expect(authService.validateUser).toHaveBeenCalledWith('alice@example.com', 'pass');
  });

  it('throws UnauthorizedException when validateUser returns null', async () => {
    authService.validateUser.mockResolvedValue(null);

    await expect(strategy.validate('bad@example.com', 'wrong')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
