import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.constants';
import { WelcomeEmailJobPayload } from '../jobs/welcome-email.job';

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
    // Replace this stub with a call to your email provider, e.g.:
    //   await this.mailerService.send({ to: email, template: 'welcome', ... })
    // The job will be retried automatically on failure (see QueueModule defaults:
    //   attempts: 3, backoff: exponential 1s → 2s → 4s).
    await simulateSend(email);

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
