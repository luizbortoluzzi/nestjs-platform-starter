import { ApiProperty } from '@nestjs/swagger';

import { IsEmail, IsString, MinLength } from 'class-validator';

// NOTE: This DTO's validators are NOT enforced by the global ValidationPipe
// for the POST /auth/login route. LocalAuthGuard (a Passport guard) runs
// before the pipe and calls LocalStrategy.validate() directly — by the time
// the pipe would normally run, the body has already been consumed.
//
// The class still serves as documentation (OpenAPI schema) and as an explicit
// body type for @ApiBody() on the login endpoint.
export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'S3cur3P@ss!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
