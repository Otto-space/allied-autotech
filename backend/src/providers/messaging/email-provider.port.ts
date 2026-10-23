export interface TransactionalEmail {
  to: string;
  replyTo?: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
  supportOutboxEventId?: string;
}

export interface EmailProvider {
  send(message: TransactionalEmail): Promise<void>;
}
