import { providerUnavailable } from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import type { SmsProvider, TransactionalSms } from "./sms-provider.port.js";

export class TermiiSmsProvider implements SmsProvider {
  private readonly endpoint = "https://v3.api.termii.com/api/sms/send";

  async send(message: TransactionalSms): Promise<void> {
    if (env.TERMII_API_KEY === undefined || env.TERMII_SENDER_ID === undefined)
      throw providerUnavailable();
    try {
      const response = await fetch(this.endpoint, {
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
      if (!response.ok) throw new Error("SMS provider rejected delivery");
      await response.body?.cancel();
    } catch (error: unknown) {
      throw providerUnavailable(error);
    }
  }
}
