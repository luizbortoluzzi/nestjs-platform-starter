import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { AppConfigService } from '../../config/config.service';
import { QUEUE_NAMES } from '../../infra/queue/queue.constants';
import { UserEntity, UserRole } from '../users/entities/user.entity';

// ─── bcrypt mock ─────────────────────────────────────────────────────────────
// Speed up tests — real bcrypt hashing is intentionally slow (cost factor 12).
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2b$12$mockhash'),
  compare: jest.fn(),
}));

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return Object.assign(new UserEntity(), {
    id: 'user-uuid-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    passwordHash: '$2b$12$mockhash',
    role: UserRole.USER,
    isActive: true,
    refreshTokenHash: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let emailsQueue: { add: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            updateRefreshToken: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-jwt-token'),
          },
        },
        {
          provide: AppConfigService,
          useValue: {
            getJwtConfig: jest.fn().mockReturnValue({
              secret: 'test-jwt-secret',
              refreshSecret: 'test-refresh-secret',
              accessExpiresIn: '15m',
              refreshExpiresIn: '7d',
            }),
          },
        },
        {
          provide: getQueueToken(QUEUE_NAMES.EMAILS),
          useValue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    emailsQueue = module.get(getQueueToken(QUEUE_NAMES.EMAILS));
  });

  afterEach(() => jest.clearAllMocks());

  // ─── register ──────────────────────────────────────────────────────────────

  describe('register', () => {
    const dto = { email: 'alice@example.com', password: 'P@ssword1!', name: 'Alice' };

    it('creates user, hashes password, issues tokens, enqueues welcome email', async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(user);

      const result = await service.register(dto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(dto.email);
      expect(bcrypt.hash).toHaveBeenCalledWith(dto.password, 12);
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: dto.email, name: dto.name }),
      );
      expect(emailsQueue.add).toHaveBeenCalledWith(
        'welcome-email',
        expect.objectContaining({ userId: user.id, email: user.email }),
      );
      expect(result).toEqual({ accessToken: 'signed-jwt-token', refreshToken: 'signed-jwt-token' });
    });

    it('throws ConflictException when email is already taken', async () => {
      usersService.findByEmail.mockResolvedValue(makeUser());

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  // ─── login ─────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('issues a token pair for the given user', async () => {
      const user = makeUser();
      const result = await service.login(user);

      expect(jwtService.sign).toHaveBeenCalledTimes(2); // access + refresh
      expect(result).toEqual({ accessToken: 'signed-jwt-token', refreshToken: 'signed-jwt-token' });
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith(
        user.id,
        expect.any(String), // bcrypt hash
      );
    });
  });

  // ─── logout ────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('clears the refresh token hash for the given user', async () => {
      await service.logout('user-uuid-1');
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith('user-uuid-1', null);
    });
  });

  // ─── validateUser ──────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns the user when credentials are valid', async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('alice@example.com', 'P@ssword1!');
      expect(result).toBe(user);
    });

    it('returns null when user is not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('unknown@example.com', 'P@ssword1!');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      const user = makeUser();
      usersService.findByEmail.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('alice@example.com', 'wrongpassword');
      expect(result).toBeNull();
    });

    it('returns null when user account is inactive', async () => {
      const inactiveUser = makeUser({ isActive: false });
      usersService.findByEmail.mockResolvedValue(inactiveUser);

      const result = await service.validateUser('alice@example.com', 'P@ssword1!');
      expect(result).toBeNull();
      // Should not even attempt password check
      expect(bcrypt.compare).not.toHaveBeenCalled();
    });
  });

  // ─── refreshTokens ─────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('rotates the token pair when the refresh token is valid', async () => {
      const user = makeUser({ refreshTokenHash: '$2b$10$refreshhash' });
      usersService.findById.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.refreshTokens('user-uuid-1', 'incoming-refresh-token');
      expect(result).toEqual({ accessToken: 'signed-jwt-token', refreshToken: 'signed-jwt-token' });
    });

    it('throws UnauthorizedException when no active session exists', async () => {
      const user = makeUser({ refreshTokenHash: null });
      usersService.findById.mockResolvedValue(user);

      await expect(service.refreshTokens('user-uuid-1', 'any-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('clears session and throws UnauthorizedException on token mismatch (reuse detection)', async () => {
      const user = makeUser({ refreshTokenHash: '$2b$10$refreshhash' });
      usersService.findById.mockResolvedValue(user);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.refreshTokens('user-uuid-1', 'rotated-token')).rejects.toThrow(
        UnauthorizedException,
      );
      // Session must be invalidated to prevent further reuse
      expect(usersService.updateRefreshToken).toHaveBeenCalledWith('user-uuid-1', null);
    });
  });
});
