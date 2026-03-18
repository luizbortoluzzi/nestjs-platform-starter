import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserEntity } from '../users/entities/user.entity';
import { AppConfigService } from '../../config/config.service';
import { RegisterDto } from './dto/register.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { JwtPayload, JwtRefreshPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<TokenPairDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
    });

    return this.issueTokenPair(user);
  }

  async login(user: UserEntity): Promise<TokenPairDto> {
    return this.issueTokenPair(user);
  }

  async logout(userId: string): Promise<void> {
    // Clearing the hash invalidates any outstanding refresh token immediately.
    await this.usersService.updateRefreshToken(userId, null);
  }

  /**
   * Validates the incoming refresh token against the stored hash, then rotates
   * both tokens (access + refresh). Old refresh token becomes invalid after this.
   */
  async refreshTokens(userId: string, incomingToken: string): Promise<TokenPairDto> {
    const user = await this.usersService.findById(userId);

    if (!user.refreshTokenHash) {
      // No active session — user has logged out or never logged in.
      throw new UnauthorizedException('No active session');
    }

    const isValid = await bcrypt.compare(incomingToken, user.refreshTokenHash);
    if (!isValid) {
      // Token mismatch — possible reuse of a rotated token; treat as attack.
      await this.usersService.updateRefreshToken(userId, null);
      throw new UnauthorizedException('Refresh token is invalid or has been rotated');
    }

    return this.issueTokenPair(user);
  }

  /**
   * Validates email + password credentials.
   * Called exclusively by LocalStrategy. Returns the full UserEntity on success
   * so login() can embed claims directly — returns null on failure.
   */
  async validateUser(email: string, password: string): Promise<UserEntity | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.isActive) return null;

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return null;

    return user;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async issueTokenPair(user: UserEntity): Promise<TokenPairDto> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = this.signRefreshToken(user);

    // Hash before storing — a compromised DB cannot replay refresh tokens.
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    await this.usersService.updateRefreshToken(user.id, refreshTokenHash);

    return { accessToken, refreshToken };
  }

  private signAccessToken(user: UserEntity): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    return this.jwtService.sign(payload);
  }

  private signRefreshToken(user: UserEntity): string {
    const payload: JwtRefreshPayload = { sub: user.id };
    const { refreshSecret, refreshExpiresIn } = this.configService.getJwtConfig();
    return this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });
  }
}
