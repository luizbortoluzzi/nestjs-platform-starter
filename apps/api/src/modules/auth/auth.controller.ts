import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserEntity } from '../users/entities/user.entity';
import { RefreshUser } from './strategies/jwt-refresh.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Creates a new account and returns a token pair.
   * Public — no authentication required.
   */
  @Post('register')
  @Public()
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(IdempotencyInterceptor)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  @ApiResponse({ status: 201, description: 'Account created.', type: TokenPairDto })
  @ApiResponse({ status: 400, description: 'Validation error.' })
  @ApiResponse({ status: 409, description: 'Email already in use.' })
  register(@Body() dto: RegisterDto): Promise<TokenPairDto> {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticates with email + password (validated by LocalStrategy).
   * Returns a token pair on success.
   * Public — guarded by LocalAuthGuard, not JwtAuthGuard.
   */
  @Post('login')
  @Public()
  @UseGuards(LocalAuthGuard)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: 'Login successful.', type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials.' })
  login(@CurrentUser() user: UserEntity): Promise<TokenPairDto> {
    return this.authService.login(user);
  }

  /**
   * POST /auth/logout
   * Invalidates the current refresh token by clearing its stored hash.
   * Requires a valid access token — uses the global JwtAuthGuard.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Invalidate the current session' })
  @ApiResponse({ status: 200, description: 'Logged out.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token.' })
  async logout(@CurrentUser() user: AuthenticatedUser): Promise<null> {
    await this.authService.logout(user.id);
    return null;
  }

  /**
   * POST /auth/refresh
   * Exchanges a valid refresh token for a new token pair (rotation).
   * Public on the JWT guard level — guarded by JwtRefreshGuard instead.
   * Send the refresh token as: Authorization: Bearer <refreshToken>
   */
  @Post('refresh')
  @Public()
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Rotate tokens using a valid refresh token' })
  @ApiResponse({ status: 200, description: 'Tokens rotated.', type: TokenPairDto })
  @ApiResponse({ status: 401, description: 'Refresh token invalid or expired.' })
  refresh(@CurrentUser() user: RefreshUser): Promise<TokenPairDto> {
    return this.authService.refreshTokens(user.userId, user.refreshToken);
  }
}
