import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AppCacheService } from '../../infra/cache/cache.service';
import { RegisterDto } from './dto/register.dto';
import { UserEntity, UserRole } from '../users/entities/user.entity';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RefreshUser } from './strategies/jwt-refresh.strategy';

const TOKEN_PAIR = { accessToken: 'access', refreshToken: 'refresh' };

function makeUser(): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'u1',
    email: 'alice@example.com',
    role: UserRole.USER,
  });
}

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<
    Pick<AuthService, 'register' | 'login' | 'logout' | 'refreshTokens'>
  >;

  beforeEach(async () => {
    authService = {
      register: jest.fn().mockResolvedValue(TOKEN_PAIR),
      login: jest.fn().mockResolvedValue(TOKEN_PAIR),
      logout: jest.fn().mockResolvedValue(undefined),
      refreshTokens: jest.fn().mockResolvedValue(TOKEN_PAIR),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: authService },
        {
          provide: AppCacheService,
          useValue: { get: jest.fn(), set: jest.fn(), setIfNotExists: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('register', () => {
    it('delegates to authService.register and returns a token pair', async () => {
      const dto: RegisterDto = { email: 'alice@example.com', password: 'P@ss1!', name: 'Alice' };
      const result = await controller.register(dto);
      expect(authService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('login', () => {
    it('delegates to authService.login with the authenticated user', async () => {
      const user = makeUser();
      const result = await controller.login(user);
      expect(authService.login).toHaveBeenCalledWith(user);
      expect(result).toEqual(TOKEN_PAIR);
    });
  });

  describe('logout', () => {
    it('calls authService.logout with the user id and returns null', async () => {
      const user: AuthenticatedUser = { id: 'u1', email: 'a@b.com', role: UserRole.USER };
      const result = await controller.logout(user);
      expect(authService.logout).toHaveBeenCalledWith('u1');
      expect(result).toBeNull();
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refreshTokens with userId and refreshToken', async () => {
      const refreshUser: RefreshUser = { userId: 'u1', refreshToken: 'rt' };
      const result = await controller.refresh(refreshUser);
      expect(authService.refreshTokens).toHaveBeenCalledWith('u1', 'rt');
      expect(result).toEqual(TOKEN_PAIR);
    });
  });
});
