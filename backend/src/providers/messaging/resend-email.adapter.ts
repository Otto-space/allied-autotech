import { AppError } from "../../common/errors/app-error.js";
import {
  providerRejected,
  providerUnavailable,
} from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import type { EmailProvider, TransactionalEmail } from "./email-provider.port.js";
import { withProviderResponse } from "../provider-http.js";

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
      await withProviderResponse(
        "https://api.resend.com/emails",
        {
          method: "POST",
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
        },
        env.MESSAGING_REQUEST_TIMEOUT_MS,
        (response) => {
          if (!response.ok) {
            if (
              response.status === 408 ||
              response.status === 425 ||
              response.status === 429 ||
              response.status >= 500
            )
              throw providerUnavailable();
            throw providerRejected();
          }
        },
      );
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw providerUnavailable(error);
    }
  }
}
