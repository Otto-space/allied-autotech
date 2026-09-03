import { Resend } from "resend";

import { env } from "../../config/env.js";
import type { EmailProvider, TransactionalEmail } from "./email-provider.port.js";

export class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;
  private readonly from: string;

  constructor(apiKey = env.RESEND_API_KEY, from = env.RESEND_FROM_EMAIL) {
    if (apiKey === undefined || from === undefined) {
      throw new Error("Resend email delivery is not configured");
    }
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(message: TransactionalEmail): Promise<void> {
    const result = await this.client.emails.send(
      {
        from: this.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      },
      { idempotencyKey: message.idempotencyKey },
    );
    if (result.error !== null) {
      throw new Error("Transactional email provider rejected delivery");
    }
  }
}
