# Adding a new feature module

This guide walks through creating a `tasks` module from scratch, following the
same patterns as the `projects` reference implementation. By the end you will
have a fully wired CRUD module with authentication and user ownership.

Substitute `task`/`Task`/`tasks` with your own resource name throughout.

---

## The pattern at a glance

```
src/modules/tasks/
  entities/
    task.entity.ts       ← TypeORM entity + enum definitions
  dto/
    create-task.dto.ts   ← class-validator decorators
    update-task.dto.ts   ← PartialType(CreateTaskDto)
  tasks.service.ts       ← repository operations, ownership enforcement
  tasks.controller.ts    ← route handlers, @CurrentUser()
  tasks.module.ts        ← TypeOrmModule.forFeature, exports
```

Five files. Register the module in `AppModule`, and you're done.

---

## Step 1 — Entity

`src/modules/tasks/entities/task.entity.ts`

```typescript
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export enum TaskStatus {
  TODO       = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE       = 'done',
}

@Entity('tasks')
export class TaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 300 })
  title: string;

  @Column({ type: 'text', nullable: true, default: null })
  description: string | null;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.TODO })
  status: TaskStatus;

  // Store owner FK as a plain column — avoids eager-loading the full UserEntity
  // on every query. Load the relation explicitly when you need user details.
  @Column({ name: 'owner_id' })
  ownerId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
```

**Key decisions to carry over to every entity:**

- `PrimaryGeneratedColumn('uuid')` — consistent with the rest of the schema.
- `onDelete: 'CASCADE'` on the owner relation — deleting a user cleans up
  their resources at the DB level.
- Keep the `ownerId` column separate from the `owner` relation — queries that
  only need the ID won't incur a join.

---

## Step 2 — DTOs

`src/modules/tasks/dto/create-task.dto.ts`

```typescript
import { IsString, MinLength, MaxLength, IsOptional, IsEnum } from 'class-validator';
import { TaskStatus } from '../entities/task.entity';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
```

`src/modules/tasks/dto/update-task.dto.ts`

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

// PartialType makes all fields optional and re-applies the validators.
// This is the canonical NestJS pattern for PATCH DTOs — do not duplicate rules.
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
```

---

## Step 3 — Service

`src/modules/tasks/tasks.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskEntity } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(TaskEntity)
    private readonly taskRepository: Repository<TaskEntity>,
  ) {}

  create(ownerId: string, dto: CreateTaskDto): Promise<TaskEntity> {
    const task = this.taskRepository.create({ ...dto, ownerId });
    return this.taskRepository.save(task);
  }

  // Always filter by ownerId — never return another user's data.
  findAll(ownerId: string): Promise<TaskEntity[]> {
    return this.taskRepository.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, ownerId: string): Promise<TaskEntity> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    if (task.ownerId !== ownerId) throw new ForbiddenException();
    return task;
  }

  async update(id: string, ownerId: string, dto: UpdateTaskDto): Promise<TaskEntity> {
    const task = await this.findOne(id, ownerId);
    Object.assign(task, dto);
    return this.taskRepository.save(task);
  }

  async remove(id: string, ownerId: string): Promise<void> {
    const task = await this.findOne(id, ownerId);
    await this.taskRepository.remove(task);
  }
}
```

**Ownership rule:** `findOne` is the single ownership gate. Both `update` and
`remove` call it first, so the check is never accidentally bypassed.

---

## Step 4 — Controller

`src/modules/tasks/tasks.controller.ts`

```typescript
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
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import {
  CurrentUser,
  AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

// The global JwtAuthGuard protects all routes here automatically.
// Do NOT add @Public() unless the endpoint is intentionally unauthenticated.
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.tasksService.findAll(user.id);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.update(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tasksService.remove(id, user.id);
  }
}
```

---

## Step 5 — Module

`src/modules/tasks/tasks.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskEntity } from './entities/task.entity';
import { TasksService } from './tasks.service';
import { TasksController } from './tasks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TaskEntity])],
  controllers: [TasksController],
  providers: [TasksService],
  // Export TasksService only if another module needs to call it directly.
  // A module that only exposes HTTP endpoints typically does not need to export.
  exports: [TasksService],
})
export class TasksModule {}
```

---

## Step 6 — Register in AppModule

`src/app.module.ts`

```typescript
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [
    // ... existing modules ...
    TasksModule,   // ← add here
  ],
})
export class AppModule implements NestModule { ... }
```

---

## Step 7 — Schema

If `DATABASE_SYNCHRONIZE=true` (local only), the `tasks` table is created
automatically on next startup.

For production, generate a migration:

```bash
cd apps/api
npm run migration:generate -- src/database/migrations/CreateTasksTable
npm run migration:run
```

---

## Checklist

- [ ] Entity created with UUID PK, `ownerId` FK, `onDelete: 'CASCADE'`
- [ ] `CreateDto` with class-validator decorators
- [ ] `UpdateDto` using `PartialType(CreateDto)`
- [ ] Service: all mutations call `findOne(id, ownerId)` first
- [ ] Controller: no `@Public()` on ownership-sensitive routes
- [ ] Module: `TypeOrmModule.forFeature([Entity])` imported
- [ ] Module registered in `AppModule`
- [ ] Migration generated (production / staging)

---

## When to deviate from this pattern

| Situation | Adjustment |
|---|---|
| Resource is not user-owned (e.g. reference data) | Remove `ownerId`, remove ownership check in service |
| Resource needs admin-only write access | Add `RolesGuard` + `@Roles(UserRole.ADMIN)` on mutation endpoints |
| List endpoint needs pagination | Add `page`/`limit` query params; use `findAndCount()` in service |
| Resource has nested sub-resources | Create a separate module for the sub-resource; pass parent ID as route param |
| Need to load the owner relation | Use `relations: ['owner']` in `findOne` — the `owner` field is defined but not eagerly loaded |
