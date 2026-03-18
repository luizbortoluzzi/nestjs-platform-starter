// Augments the Express Request interface with fields set by RequestIdMiddleware.
// TypeScript picks this up because it lives under src/, which is in tsconfig "include".
declare namespace Express {
  interface Request {
    /** UUID generated (or forwarded from X-Request-ID header) per incoming request. */
    requestId: string;
    /**
     * Unix ms timestamp set by RequestIdMiddleware at the very start of the request.
     * Optional because TypeScript must allow code that runs before the middleware
     * (e.g. early Express error handlers) to compile without assuming it exists.
     */
    startTime?: number;
  }
}
