import { z } from "zod";
import { providerUnavailable } from "../../common/errors/provider-error-mapper.js";
import { env } from "../../config/env.js";
import type {
  InitializePaymentCommand,
  InitiateRefundCommand,
  InitiatedRefund,
  InitializedPayment,
  PaymentProviderPort,
  VerifiedPayment,
} from "./payment-provider.port.js";

const envelope = <T extends z.ZodType>(data: T) =>
  z.object({ status: z.boolean(), message: z.string(), data });
const initializeResponse = envelope(
  z.object({
    authorization_url: z.url(),
    access_code: z.string().min(1),
    reference: z.string(),
  }),
);
const verifyResponse = envelope(
  z.object({
    id: z.union([z.string(), z.number()]),
    status: z.enum([
      "success",
      "failed",
      "abandoned",
      "pending",
      "ongoing",
      "processing",
      "queued",
    ]),
    reference: z.string(),
    amount: z.number().int().positive(),
    currency: z.string(),
    paid_at: z.string().nullable().optional(),
    fees: z.number().int().nonnegative().nullable().optional(),
    channel: z.string().nullable().optional(),
  }),
);
const refundResponse = envelope(
  z.object({ id: z.union([z.string(), z.number()]), status: z.string() }),
);

export class PaystackAdapter implements PaymentProviderPort {
  private readonly baseUrl = "https://api.paystack.co";

  private secret(): string {
    if (env.PAYSTACK_SECRET_KEY === undefined) throw providerUnavailable();
    return env.PAYSTACK_SECRET_KEY;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.secret()}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
        redirect: "error",
        signal: AbortSignal.timeout(env.PAYSTACK_REQUEST_TIMEOUT_MS),
      });
      const declaredLength = Number(response.headers.get("content-length") ?? 0);
      if (declaredLength > env.PAYSTACK_MAX_RESPONSE_BYTES)
        throw new Error("Provider response too large");
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.byteLength > env.PAYSTACK_MAX_RESPONSE_BYTES)
        throw new Error("Provider response too large");
      const body: unknown = JSON.parse(bytes.toString("utf8"));
      if (!response.ok) throw new Error("Provider rejected request");
      return body;
    } catch (error) {
      throw providerUnavailable(error);
    }
  }

  async initialize(command: InitializePaymentCommand): Promise<InitializedPayment> {
    const parsed = initializeResponse.parse(
      await this.request("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email: command.email,
          amount: command.amountKobo.toString(),
          currency: command.currency,
          reference: command.reference,
          ...(command.callbackUrl === undefined
            ? {}
            : { callback_url: command.callbackUrl }),
        }),
      }),
    );
    if (!parsed.status) throw providerUnavailable();
    return {
      authorizationUrl: parsed.data.authorization_url,
      accessCode: parsed.data.access_code,
      providerReference: parsed.data.reference,
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const parsed = verifyResponse.parse(
      await this.request(`/transaction/verify/${encodeURIComponent(reference)}`),
    );
    if (!parsed.status) throw providerUnavailable();
    const status = ["ongoing", "processing", "queued"].includes(parsed.data.status)
      ? "pending"
      : parsed.data.status;
    return {
      reference: parsed.data.reference,
      gatewayTransactionId: String(parsed.data.id),
      status: status as VerifiedPayment["status"],
      amountKobo: BigInt(parsed.data.amount),
      currency: parsed.data.currency.toUpperCase(),
      paidAt: parsed.data.paid_at ? new Date(parsed.data.paid_at) : null,
      providerFeeKobo: parsed.data.fees == null ? null : BigInt(parsed.data.fees),
      method: parsed.data.channel ?? null,
    };
  }

  async refund(command: InitiateRefundCommand): Promise<InitiatedRefund> {
    const parsed = refundResponse.parse(
      await this.request("/refund", {
        method: "POST",
        body: JSON.stringify({
          transaction: command.gatewayTransactionId,
          amount: command.amountKobo.toString(),
          currency: command.currency,
        }),
      }),
    );
    if (!parsed.status) throw providerUnavailable();
    return { providerRefundId: String(parsed.data.id), status: parsed.data.status };
  }
}

export const paystackProvider = new PaystackAdapter();
