/**
 * Retry a fallible async operation with exponential back-off.
 *
 * @param fn        The async operation to attempt.
 * @param options   Retry configuration (all optional, reasonable defaults).
 *
 * @example
 * // Retry up to 3 times; initial delay 100 ms, cap at 2 s.
 * const result = await withRetry(() => emailProvider.send(payload), {
 *   attempts: 3,
 *   baseDelayMs: 100,
 *   maxDelayMs: 2_000,
 * });
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { attempts = 3, baseDelayMs = 100, maxDelayMs = 5_000, shouldRetry } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      const isLast = attempt === attempts;
      const retryable = shouldRetry ? shouldRetry(err) : true;

      if (isLast || !retryable) {
        break;
      }

      const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}

export interface RetryOptions {
  /** Total number of attempts including the first try. Default: 3. */
  attempts?: number;
  /** Base delay in milliseconds; doubles each retry. Default: 100. */
  baseDelayMs?: number;
  /** Upper bound on retry delay in milliseconds. Default: 5 000. */
  maxDelayMs?: number;
  /**
   * Optional predicate to decide whether the error warrants a retry.
   * Return false to rethrow immediately (e.g. skip retries on 4xx errors).
   * Default: always retry.
   */
  shouldRetry?: (err: unknown) => boolean;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
