import { PartialType } from '@nestjs/swagger';

import { CreateProjectDto } from './create-project.dto';

// All fields are optional — only supplied fields are applied on PATCH.
// Uses @nestjs/swagger PartialType so Swagger marks every property as optional.
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
