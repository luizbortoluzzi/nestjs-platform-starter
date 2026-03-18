import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';

import { QUEUE_NAMES } from '../queue.constants';

@Processor(QUEUE_NAMES.NOTIFICATIONS)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  // eslint-disable-next-line @typescript-eslint/require-await
  async process(job: Job): Promise<void> {
    this.logger.log(`Processing job ${job.id} [${job.name}] attempt ${job.attemptsMade + 1}`);

    switch (job.name) {
      case 'send-push':
        this.handlePushNotification(job.data);
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
    }
  }

  private handlePushNotification(data: unknown): void {
    // TODO: implement push notification logic
    this.logger.debug(`Push notification payload: ${JSON.stringify(data)}`);
  }
}
