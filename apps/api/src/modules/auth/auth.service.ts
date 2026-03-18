import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, ConflictException, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import * as bcrypt from 'bcryptjs';
import { Queue } from 'bullmq';
import { DataSource, EntityManager } from 'typeorm';

import { RegisterDto } from './dto/register.dto';
import { TokenPairDto } from './dto/token-pair.dto';
import { JwtPayload, JwtRefreshPayload } from './interfaces/jwt-payload.interface';
import { AppConfigService } from '../../config/config.service';
import { WelcomeEmailJobPayload } from '../../infra/queue/jobs/welcome-email.job';
import { QUEUE_NAMES, JOB_NAMES } from '../../infra/queue/queue.constants';
import { UserEntity } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: AppConfigService,
    @InjectQueue(QUEUE_NAMES.EMAILS) private readonly emailsQueue: Queue,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Public API ─────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<TokenPairDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // Hash password before opening the transaction to keep the critical
    // section short (bcrypt is CPU-bound and slow by design).
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Wrap user creation + refresh-token hash in a single transaction so that
    // a partial failure (e.g. DB crash between INSERT and UPDATE) cannot leave
    // the row without a valid session state.
    const { tokens, userId, email, name } = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        const user = manager.create(UserEntity, {
          email: dto.email,
          passwordHash,
          name: dto.name,
        });
        const saved = await manager.save(user);

        const accessToken = this.signAccessToken(saved);
        const refreshToken = this.signRefreshToken(saved);
        const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
        await manager.update(UserEntity, saved.id, { refreshTokenHash });

        return {
          tokens: { accessToken, refreshToken } satisfies TokenPairDto,
          userId: saved.id,
          email: saved.email,
          name: saved.name,
        };
      },
    );

    // Enqueue welcome email after the transaction commits — fire-and-forget.
    // BullMQ persists the job; a transient Redis failure is not fatal.
    void this.emailsQueue
      .add(JOB_NAMES.WELCOME_EMAIL, { userId, email, name } satisfies WelcomeEmailJobPayload)
      .catch((err: unknown) =>
        this.logger.warn(`Failed to enqueue welcome email for ${email}: ${String(err)}`),
      );

    return tokens;
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
