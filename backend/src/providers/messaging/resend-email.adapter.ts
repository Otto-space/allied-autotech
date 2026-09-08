import { providerUnavailable } from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import type { EmailProvider, TransactionalEmail } from "./email-provider.port.js";

export class ResendEmailProvider implements EmailProvider {
  private readonly apiKey: string;
  private readonly from: string;

  constructor(apiKey = env.RESEND_API_KEY, from = env.RESEND_FROM_EMAIL) {
    if (apiKey === undefined || from === undefined) {
      throw new Error("Resend email delivery is not configured");
    }
    this.apiKey = apiKey;
    this.from = from;
  }

  async send(message: TransactionalEmail): Promise<void> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(env.MESSAGING_REQUEST_TIMEOUT_MS),
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: this.from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          html: message.html,
        }),
      });
      if (!response.ok) throw new Error("Email provider rejected delivery");
      await response.body?.cancel();
    } catch (error: unknown) {
      throw providerUnavailable(error);
    }
  }
}
