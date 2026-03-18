import { Test, TestingModule } from '@nestjs/testing';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectEntity, ProjectStatus } from './entities/project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AppCacheService } from '../../infra/cache/cache.service';
import { UserRole } from '../users/entities/user.entity';

const PROJECT_ID = 'proj-uuid-1';

function makeProject(overrides: Partial<ProjectEntity> = {}): ProjectEntity {
  return Object.assign(new ProjectEntity(), {
    id: PROJECT_ID,
    name: 'My Project',
    description: 'Desc',
    status: ProjectStatus.ACTIVE,
    ownerId: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
}

const currentUser: AuthenticatedUser = {
  id: 'u1',
  email: 'alice@example.com',
  role: UserRole.USER,
};

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: jest.Mocked<
    Pick<ProjectsService, 'create' | 'findAll' | 'findOne' | 'update' | 'remove'>
  >;
  let project: ProjectEntity;

  beforeEach(async () => {
    project = makeProject();
    projectsService = {
      create: jest.fn().mockResolvedValue(project),
      findAll: jest.fn().mockResolvedValue([project]),
      findOne: jest.fn().mockResolvedValue(project),
      update: jest.fn().mockResolvedValue(project),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projectsService },
        {
          provide: AppCacheService,
          useValue: { get: jest.fn(), set: jest.fn(), setIfNotExists: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get(ProjectsController);
  });

  describe('create', () => {
    it('calls projectsService.create with ownerId and dto', async () => {
      const dto: CreateProjectDto = { name: 'New Project' };
      const result = await controller.create(currentUser, dto);
      expect(projectsService.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toBe(project);
    });
  });

  describe('findAll', () => {
    it('calls projectsService.findAll with ownerId', async () => {
      const result = await controller.findAll(currentUser);
      expect(projectsService.findAll).toHaveBeenCalledWith('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('calls projectsService.findOne with project id and ownerId', async () => {
      const result = await controller.findOne(PROJECT_ID, currentUser);
      expect(projectsService.findOne).toHaveBeenCalledWith(PROJECT_ID, 'u1');
      expect(result).toBe(project);
    });
  });

  describe('update', () => {
    it('calls projectsService.update with project id, ownerId, and dto', async () => {
      const dto: UpdateProjectDto = { name: 'Updated' };
      const result = await controller.update(PROJECT_ID, currentUser, dto);
      expect(projectsService.update).toHaveBeenCalledWith(PROJECT_ID, 'u1', dto);
      expect(result).toBe(project);
    });
  });

  describe('remove', () => {
    it('calls projectsService.remove with project id and ownerId', async () => {
      await controller.remove(PROJECT_ID, currentUser);
      expect(projectsService.remove).toHaveBeenCalledWith(PROJECT_ID, 'u1');
    });
  });
});
