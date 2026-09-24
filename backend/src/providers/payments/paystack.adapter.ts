import { z } from "zod";
import { AppError } from "../../common/errors/app-error.js";
import {
  providerRejected,
  providerUnavailable,
} from "../../common/errors/provider-error-mapper.js";
import { assertPaystackMode, env } from "../../config/env.js";
import type {
  InitializePaymentCommand,
  InitiateRefundCommand,
  InitiatedRefund,
  InitializedPayment,
  PaymentProviderPort,
  VerifiedPayment,
  VerifiedRefund,
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
    domain: z.enum(["test", "live"]).optional(),
    amount: z.number().int().safe().positive(),
    currency: z.string(),
    paid_at: z.string().nullable().optional(),
    fees: z.number().int().safe().nonnegative().nullable().optional(),
    channel: z.string().nullable().optional(),
  }),
);
const refundResponse = envelope(
  z.object({ id: z.union([z.string(), z.number()]), status: z.string() }),
);

function parseProviderResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw providerUnavailable();
  return parsed.data;
}

export class PaystackAdapter implements PaymentProviderPort {
  private readonly baseUrl = "https://api.paystack.co";

  private secret(): string {
    assertPaystackMode();
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
      return body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw providerUnavailable(error);
    }
  }

  async initialize(command: InitializePaymentCommand): Promise<InitializedPayment> {
    const parsed = parseProviderResponse(
      initializeResponse,
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
      authorizationExpiresAt: new Date(
        Date.now() + env.PAYMENT_INTENT_TTL_SECONDS * 1_000,
      ),
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const parsed = parseProviderResponse(
      verifyResponse,
      await this.request(`/transaction/verify/${encodeURIComponent(reference)}`),
    );
    if (!parsed.status) throw providerUnavailable();
    if (parsed.data.domain && parsed.data.domain !== env.PAYSTACK_MODE)
      throw providerRejected();
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

  async verifyRefund(reference: string): Promise<VerifiedRefund> {
    const schema = envelope(
      z.object({
        id: z.union([z.string(), z.number()]),
        status: z.string(),
        amount: z.union([z.string().regex(/^\d+$/), z.number().int().safe().positive()]),
        currency: z.string().length(3),
      }),
    );
    const parsed = parseProviderResponse(
      schema,
      await this.request(`/refund/${encodeURIComponent(reference)}`),
    );
    if (!parsed.status) throw providerUnavailable();
    return {
      providerRefundId: String(parsed.data.id),
      status:
        parsed.data.status === "processed"
          ? "succeeded"
          : ["failed", "needs-attention"].includes(parsed.data.status)
            ? "failed"
            : "pending",
      amountKobo: BigInt(parsed.data.amount),
      currency: parsed.data.currency.toUpperCase(),
    };
  }

  async refund(command: InitiateRefundCommand): Promise<InitiatedRefund> {
    const parsed = parseProviderResponse(
      refundResponse,
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
