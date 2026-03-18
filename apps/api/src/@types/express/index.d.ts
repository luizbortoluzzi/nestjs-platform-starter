// Augments the Express Request interface with fields set by RequestIdMiddleware.
// TypeScript picks this up because it lives under src/, which is in tsconfig "include".
declare namespace Express {
  interface Request {
    /** UUID generated (or forwarded from X-Request-ID header) per incoming request. */
    requestId: string;
    /** Unix ms timestamp set at the start of the request — used to compute duration. */
    startTime: number;
  }
}
