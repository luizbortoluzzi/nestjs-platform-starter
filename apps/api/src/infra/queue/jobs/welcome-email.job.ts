/**
 * Payload for the welcome-email job.
 *
 * Kept minimal — include only what the processor needs to send the email.
 * Do NOT include sensitive data (passwords, tokens) in job payloads;
 * they are stored in Redis and appear in BullMQ's job inspection UI.
 */
export interface WelcomeEmailJobPayload {
  userId: string;
  email: string;
  name: string;
}
