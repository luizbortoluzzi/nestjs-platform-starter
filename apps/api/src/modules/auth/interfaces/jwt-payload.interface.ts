/**
 * Payload embedded in access tokens.
 * Kept minimal — only stable, non-sensitive identifiers.
 */
export interface JwtPayload {
  sub: string; // user UUID
  email: string;
  role: string;
}

/**
 * Payload embedded in refresh tokens.
 * Contains only the user ID. The token's long TTL is its only privilege;
 * additional claims are re-fetched from the database on every refresh.
 */
export interface JwtRefreshPayload {
  sub: string; // user UUID
}
