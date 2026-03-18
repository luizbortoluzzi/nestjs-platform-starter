import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — bypasses the global JwtAuthGuard.
 * All routes are protected by default; use @Public() to opt out.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
