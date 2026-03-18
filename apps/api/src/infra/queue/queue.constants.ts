export const QUEUE_NAMES = {
  NOTIFICATIONS: 'notifications',
  EMAILS: 'emails',
} as const;

export const JOB_NAMES = {
  WELCOME_EMAIL: 'welcome-email',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
