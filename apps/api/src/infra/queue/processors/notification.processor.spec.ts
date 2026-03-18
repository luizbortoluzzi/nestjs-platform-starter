import { Job } from 'bullmq';

import { NotificationProcessor } from './notification.processor';

function makeJob(name: string, data: unknown = {}): Job {
  return { id: 'job-1', name, data, attemptsMade: 0 } as unknown as Job;
}

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  beforeEach(() => {
    processor = new NotificationProcessor();
  });

  it('processes a send-push job without throwing', async () => {
    await expect(
      processor.process(makeJob('send-push', { token: 'abc', body: 'Hello' })),
    ).resolves.toBeUndefined();
  });

  it('logs a warning for unknown job names without throwing', async () => {
    await expect(processor.process(makeJob('unknown-job'))).resolves.toBeUndefined();
  });
});
