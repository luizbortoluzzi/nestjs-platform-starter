import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserEntity, UserRole } from './entities/user.entity';

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

describe('UsersService', () => {
  let service: UsersService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: getRepositoryToken(UserEntity), useValue: repo }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── findById ──────────────────────────────────────────────────────────────

  describe('findById', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      repo.findOne.mockResolvedValue(user);

      const result = await service.findById('user-uuid-1');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-1' } });
      expect(result).toBe(user);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail', () => {
    it('returns the user when found', async () => {
      const user = makeUser();
      repo.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('alice@example.com');

      expect(repo.findOne).toHaveBeenCalledWith({ where: { email: 'alice@example.com' } });
      expect(result).toBe(user);
    });

    it('returns null when no user matches the email', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });
  });

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('persists and returns the new user', async () => {
      const data = { email: 'bob@example.com', passwordHash: '$2b$12$hash', name: 'Bob' };
      const entity = makeUser({ ...data, id: 'user-uuid-2' });
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.create(data);

      expect(repo.create).toHaveBeenCalledWith(data);
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('applies changes and returns the updated user', async () => {
      const updated = makeUser({ name: 'Alice Updated' });
      repo.findOne.mockResolvedValue(updated);

      const result = await service.update('user-uuid-1', { name: 'Alice Updated' });

      expect(repo.update).toHaveBeenCalledWith('user-uuid-1', { name: 'Alice Updated' });
      expect(result).toBe(updated);
    });

    it('throws NotFoundException when the user to update does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('missing-id', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // ─── updateRefreshToken ────────────────────────────────────────────────────

  describe('updateRefreshToken', () => {
    it('persists the new token hash', async () => {
      await service.updateRefreshToken('user-uuid-1', '$2b$10$newhash');

      expect(repo.update).toHaveBeenCalledWith('user-uuid-1', {
        refreshTokenHash: '$2b$10$newhash',
      });
    });

    it('clears the token hash on logout (null)', async () => {
      await service.updateRefreshToken('user-uuid-1', null);

      expect(repo.update).toHaveBeenCalledWith('user-uuid-1', { refreshTokenHash: null });
    });
  });
});
