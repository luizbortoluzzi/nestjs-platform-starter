import { IsEmail, IsString, MinLength } from 'class-validator';

// NOTE: This DTO's validators are NOT enforced by the global ValidationPipe
// for the POST /auth/login route. LocalAuthGuard (a Passport guard) runs
// before the pipe and calls LocalStrategy.validate() directly — by the time
// the pipe would normally run, the body has already been consumed.
//
// This class still serves as documentation (shape contract) and can be used
// for explicit validation if the login endpoint is ever restructured to skip
// the Passport guard in favour of a plain body-parsing approach.
export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}
