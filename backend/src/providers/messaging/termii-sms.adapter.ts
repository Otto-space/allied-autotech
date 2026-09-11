import { AppError } from "../../common/errors/app-error.js";
import {
  providerRejected,
  providerUnavailable,
} from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import type { SmsProvider, TransactionalSms } from "./sms-provider.port.js";

export class TermiiSmsProvider implements SmsProvider {
  async send(message: TransactionalSms): Promise<void> {
    if (
      env.TERMII_API_KEY === undefined ||
      env.TERMII_SENDER_ID === undefined ||
      env.TERMII_BASE_URL === undefined
    )
      throw providerUnavailable();
    try {
      const response = await fetch(new URL("/api/sms/send", env.TERMII_BASE_URL), {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(env.MESSAGING_REQUEST_TIMEOUT_MS),
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: env.TERMII_API_KEY,
          to: message.to,
          from: env.TERMII_SENDER_ID,
          sms: message.text,
          type: "plain",
          channel: "generic",
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        if (
          response.status === 408 ||
          response.status === 425 ||
          response.status === 429 ||
          response.status >= 500
        )
          throw providerUnavailable();
        throw providerRejected();
      }
      await response.body?.cancel();
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      throw providerUnavailable(error);
    }
  }
}
