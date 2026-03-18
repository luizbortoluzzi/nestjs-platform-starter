import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ProjectEntity, ProjectStatus } from './entities/project.entity';
import { ProjectsService } from './projects.service';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: 'project-uuid-1',
    name: 'My Project',
    description: 'A test project',
    status: ProjectStatus.ACTIVE,
    ownerId: 'owner-uuid-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('ProjectsService', () => {
  let service: ProjectsService;

  const mockRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        { provide: getRepositoryToken(ProjectEntity), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates a project bound to the ownerId', async () => {
      const dto = { name: 'New Project', description: 'desc' };
      const project = makeProject({ ...dto, ownerId: 'owner-uuid-1' });

      mockRepo.create.mockReturnValue(project);
      mockRepo.save.mockResolvedValue(project);

      const result = await service.create('owner-uuid-1', dto);

      expect(mockRepo.create).toHaveBeenCalledWith({ ...dto, ownerId: 'owner-uuid-1' });
      expect(mockRepo.save).toHaveBeenCalledWith(project);
      expect(result.ownerId).toBe('owner-uuid-1');
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('returns only projects owned by the caller', async () => {
      const projects = [makeProject(), makeProject({ id: 'project-uuid-2' })];
      mockRepo.find.mockResolvedValue(projects);

      const result = await service.findAll('owner-uuid-1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { ownerId: 'owner-uuid-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('returns the project when found and caller is the owner', async () => {
      const project = makeProject();
      mockRepo.findOne.mockResolvedValue(project);

      const result = await service.findOne('project-uuid-1', 'owner-uuid-1');
      expect(result).toBe(project);
    });

    it('throws NotFoundException when project does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id', 'owner-uuid-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when caller is not the owner', async () => {
      const project = makeProject({ ownerId: 'other-owner-uuid' });
      mockRepo.findOne.mockResolvedValue(project);

      await expect(service.findOne('project-uuid-1', 'owner-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('applies partial changes and saves the project', async () => {
      const project = makeProject();
      mockRepo.findOne.mockResolvedValue(project);
      mockRepo.save.mockResolvedValue({ ...project, name: 'Renamed' });

      const result = await service.update('project-uuid-1', 'owner-uuid-1', { name: 'Renamed' });

      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Renamed');
    });

    it('propagates ForbiddenException when caller does not own the project', async () => {
      const project = makeProject({ ownerId: 'other-owner-uuid' });
      mockRepo.findOne.mockResolvedValue(project);

      await expect(
        service.update('project-uuid-1', 'owner-uuid-1', { name: 'Hack' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── remove ────────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('removes the project when caller is the owner', async () => {
      const project = makeProject();
      mockRepo.findOne.mockResolvedValue(project);
      mockRepo.remove.mockResolvedValue(undefined);

      await expect(service.remove('project-uuid-1', 'owner-uuid-1')).resolves.not.toThrow();
      expect(mockRepo.remove).toHaveBeenCalledWith(project);
    });

    it('throws ForbiddenException when caller does not own the project', async () => {
      const project = makeProject({ ownerId: 'other-owner-uuid' });
      mockRepo.findOne.mockResolvedValue(project);

      await expect(service.remove('project-uuid-1', 'owner-uuid-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
