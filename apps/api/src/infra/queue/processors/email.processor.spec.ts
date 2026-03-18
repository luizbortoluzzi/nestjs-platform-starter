import { Job } from 'bullmq';

import { EmailProcessor } from './email.processor';
import { JOB_NAMES } from '../queue.constants';

// Mock withRetry to avoid real async delays and to control failure scenarios.
jest.mock('../../../common/utils/retry.util', () => ({
  withRetry: jest.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

// Mock setTimeout used by simulateSend inside the processor.
jest.useFakeTimers();

function makeJob(name: string, data: unknown = {}): Job {
  return {
    id: 'job-1',
    name,
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as unknown as Job;
}

describe('EmailProcessor', () => {
  let processor: EmailProcessor;

  beforeEach(() => {
    processor = new EmailProcessor();
  });

  afterEach(() => jest.clearAllMocks());

  afterAll(() => jest.useRealTimers());

  it('processes a welcome-email job without throwing', async () => {
    const job = makeJob(JOB_NAMES.WELCOME_EMAIL, {
      userId: 'u1',
      email: 'alice@example.com',
      name: 'Alice',
    });

    const promise = processor.process(job);
    await jest.runAllTimersAsync();
    await expect(promise).resolves.toBeUndefined();
  });

  it('logs a warning for unknown job names without throwing', async () => {
    const job = makeJob('unknown-type', {});
    await expect(processor.process(job)).resolves.toBeUndefined();
  });

  it('onFailed logs the error without throwing', () => {
    const job = makeJob(JOB_NAMES.WELCOME_EMAIL, {});
    expect(() => processor.onFailed(job, new Error('send failed'))).not.toThrow();
  });

  it('onCompleted logs without throwing', () => {
    const job = makeJob(JOB_NAMES.WELCOME_EMAIL, {});
    expect(() => processor.onCompleted(job)).not.toThrow();
  });
});
