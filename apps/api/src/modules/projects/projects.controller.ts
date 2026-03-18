import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

// All routes inherit the global JwtAuthGuard — no @Public() needed here.
@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * Create a new project owned by the authenticated user.
   */
  @Post()
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new project' })
  @ApiResponse({ status: 201, description: 'Project created.' })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(user.id, dto);
  }

  /**
   * List all projects belonging to the authenticated user.
   */
  @Get()
  @ApiOperation({ summary: 'List all projects owned by the authenticated user' })
  @ApiResponse({ status: 200, description: 'Project list.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.projectsService.findAll(user.id);
  }

  /**
   * Get a single project by ID.
   * Returns 403 if the project exists but belongs to another user.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project found.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Project belongs to another user.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.findOne(id, user.id);
  }

  /**
   * Partially update a project.
   * Returns 403 if the project belongs to another user.
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project updated.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Project belongs to another user.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(id, user.id, dto);
  }

  /**
   * Delete a project permanently.
   * Returns 403 if the project belongs to another user.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a project' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  @ApiResponse({ status: 204, description: 'Project deleted.' })
  @ApiResponse({ status: 401, description: 'Not authenticated.' })
  @ApiResponse({ status: 403, description: 'Project belongs to another user.' })
  @ApiResponse({ status: 404, description: 'Project not found.' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.projectsService.remove(id, user.id);
  }
}
