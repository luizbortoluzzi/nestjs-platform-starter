import { withRetry } from './retry.util';

// Use a tiny delay so tests don't wait for real timeouts.
const FAST: { baseDelayMs: number; maxDelayMs: number } = { baseDelayMs: 1, maxDelayMs: 5 };

describe('withRetry', () => {
  it('returns the result on the first attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');

    const result = await withRetry(fn);

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries after a failure and returns on the second attempt', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('ok');

    const result = await withRetry(fn, { attempts: 3, ...FAST });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws the last error after exhausting all attempts', async () => {
    const error = new Error('always fails');
    const fn = jest.fn().mockRejectedValue(error);

    await expect(withRetry(fn, { attempts: 3, ...FAST })).rejects.toThrow(error);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('stops immediately when shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('non-retryable'));

    await expect(withRetry(fn, { attempts: 5, ...FAST, shouldRetry: () => false })).rejects.toThrow(
      'non-retryable',
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('continues retrying when shouldRetry returns true', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('done');

    const result = await withRetry(fn, { attempts: 3, ...FAST, shouldRetry: () => true });

    expect(result).toBe('done');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses default of 3 attempts when not specified', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('fail'));

    await expect(withRetry(fn, FAST)).rejects.toThrow();
    expect(fn).toHaveBeenCalledTimes(3);
  });
});
