import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectEntity } from './entities/project.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([ProjectEntity])],
  controllers: [ProjectsController],
  providers: [ProjectsService, IdempotencyInterceptor],
  exports: [ProjectsService],
})
export class ProjectsModule {}
