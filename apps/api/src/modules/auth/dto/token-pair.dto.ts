import { ApiProperty } from '@nestjs/swagger';

export class TokenPairDto {
  @ApiProperty({ description: 'Short-lived JWT access token (15 min default)' })
  accessToken: string;

  @ApiProperty({ description: 'Long-lived JWT refresh token (7 day default). Store securely.' })
  refreshToken: string;
}
