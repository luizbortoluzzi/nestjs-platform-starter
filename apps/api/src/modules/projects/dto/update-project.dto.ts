import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-project.dto';

// All fields are optional — only supplied fields are applied on PATCH.
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
