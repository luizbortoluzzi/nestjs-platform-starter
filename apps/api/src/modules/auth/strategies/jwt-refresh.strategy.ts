import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';

import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { AppConfigService } from '../../../config/config.service';
import { JwtRefreshPayload } from '../interfaces/jwt-payload.interface';

export interface RefreshUser {
  userId: string;
  refreshToken: string;
}

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(configService: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getJwtConfig().refreshSecret,
      // passReqToCallback lets validate() receive the raw request so we can
      // extract the incoming token string for bcrypt comparison.
      passReqToCallback: true,
    });
  }

  validate(request: Request, payload: JwtRefreshPayload): RefreshUser {
    const authHeader = (request.headers['authorization'] as string) ?? '';
    const refreshToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    return { userId: payload.sub, refreshToken };
  }
}
