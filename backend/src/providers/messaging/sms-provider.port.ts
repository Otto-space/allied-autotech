export interface TransactionalSms {
  to: string;
  text: string;
  idempotencyKey: string;
}

export interface SmsProvider {
  send(message: TransactionalSms): Promise<void>;
}
