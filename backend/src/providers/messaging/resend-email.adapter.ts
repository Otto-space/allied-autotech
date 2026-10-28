import { AppError } from "../../common/errors/app-error.js";
import { z } from "zod";
import { emailSenderSchema } from "../../config/email-settings.js";
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
  private readonly replyTo: string | undefined;

  constructor(
    apiKey = env.RESEND_API_KEY,
    from = env.RESEND_FROM_EMAIL,
    replyTo = env.RESEND_REPLY_TO_EMAIL,
  ) {
    if (apiKey === undefined || from === undefined) {
      throw new Error("Resend email delivery is not configured");
    }
    this.apiKey = apiKey;
    this.from = emailSenderSchema.parse(from);
    this.replyTo = replyTo === undefined ? undefined : z.email().parse(replyTo);
  }

  async send(message: TransactionalEmail): Promise<void> {
    const replyTo = message.replyTo ?? this.replyTo;
    if (replyTo !== undefined && !z.email().safeParse(replyTo).success)
      throw providerRejected();
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
            ...(replyTo === undefined ? {} : { reply_to: replyTo }),
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html: message.html,
            ...(message.supportOutboxEventId
              ? {
                  tags: [
                    {
                      name: "support_outbox_event_id",
                      value: message.supportOutboxEventId,
                    },
                  ],
                }
              : {}),
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
