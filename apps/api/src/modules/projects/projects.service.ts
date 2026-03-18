import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectEntity } from './entities/project.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(ProjectEntity)
    private readonly projectRepository: Repository<ProjectEntity>,
  ) {}

  create(ownerId: string, dto: CreateProjectDto): Promise<ProjectEntity> {
    const project = this.projectRepository.create({ ...dto, ownerId });
    return this.projectRepository.save(project);
  }

  // Returns only the caller's own projects — no cross-tenant leakage.
  findAll(ownerId: string): Promise<ProjectEntity[]> {
    return this.projectRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<ProjectEntity> {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    if (project.ownerId !== ownerId) throw new ForbiddenException();
    return project;
  }

  async update(
    id: string,
    ownerId: string,
    dto: UpdateProjectDto,
  ): Promise<ProjectEntity> {
    const project = await this.findOne(id, ownerId);
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const project = await this.findOne(id, ownerId);
    await this.projectRepository.remove(project);
  }
}
