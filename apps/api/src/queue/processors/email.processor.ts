import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { WelcomeEmailJobPayload } from '../jobs/welcome-email.job';
import { withRetry } from '../../common/utils/retry.util';

@Processor(QUEUE_NAMES.EMAILS, {
  // Limit concurrent email jobs — avoids hammering the email provider
  // during burst registration events (e.g. after a product launch).
  concurrency: 5,
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  async process(job: Job<WelcomeEmailJobPayload>): Promise<void> {
    this.logger.log(
      `Processing job ${job.id} [${job.name}] attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`,
    );

    switch (job.name) {
      case JOB_NAMES.WELCOME_EMAIL:
        await this.handleWelcomeEmail(job);
        break;
      default:
        this.logger.warn(
          `Received unknown job name "${job.name}" on queue "${QUEUE_NAMES.EMAILS}" — skipping`,
        );
    }
  }

  // ─── Job handlers ───────────────────────────────────────────────────────────

  private async handleWelcomeEmail(job: Job<WelcomeEmailJobPayload>): Promise<void> {
    const { userId, email, name } = job.data;

    this.logger.log(`Sending welcome email to ${name} <${email}> (userId: ${userId})`);

    // ─── Email provider integration goes here ────────────────────────────────
    // Replace simulateSend() with a real provider call, e.g.:
    //   await this.mailerService.send({ to: email, template: 'welcome', ... })
    //
    // Two-level retry:
    //  Inner (withRetry): fast retries for transient provider errors (network
    //    blips, 5xx responses) — 3 attempts, 100 ms base, capped at 2 s.
    //  Outer (BullMQ job): slow retries for more persistent failures — 3
    //    attempts, exponential back-off starting at 1 s (see QueueModule).
    await withRetry(() => simulateSend(email), {
      attempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 2_000,
    });

    this.logger.log(`Welcome email delivered to ${name} <${email}>`);
  }

  // ─── Worker lifecycle events ─────────────────────────────────────────────────

  @OnWorkerEvent('failed')
  onFailed(job: Job<WelcomeEmailJobPayload>, error: Error): void {
    this.logger.error(
      `Job ${job.id} [${job.name}] failed on attempt ${job.attemptsMade}/${job.opts.attempts ?? 1}: ${error.message}`,
      error.stack,
    );
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WelcomeEmailJobPayload>): void {
    this.logger.debug(`Job ${job.id} [${job.name}] completed`);
  }
}

// ─── Stub helpers ─────────────────────────────────────────────────────────────

/** Simulates async I/O latency. Replace with a real email provider call. */
function simulateSend(_email: string): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}
