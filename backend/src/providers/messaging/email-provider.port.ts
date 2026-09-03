export interface TransactionalEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  send(message: TransactionalEmail): Promise<void>;
}
