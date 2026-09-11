import { z } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import {
  providerRejected,
  providerUnavailable,
} from "../../common/errors/provider-error-mapper.js";
import { assertMonnifyMode, env } from "../../config/env.js";
import type {
  InitializePaymentCommand,
  InitiateRefundCommand,
  InitiatedRefund,
  InitializedPayment,
  PaymentProviderPort,
  VerifiedPayment,
  VerifiedRefund,
} from "./payment-provider.port.js";

const monnifyEnvelope = <T extends z.ZodType>(body: T) =>
  z.object({
    requestSuccessful: z.boolean(),
    responseMessage: z.string(),
    responseCode: z.string(),
    responseBody: body,
  });
const authResponse = monnifyEnvelope(
  z.object({ accessToken: z.string().min(20), expiresIn: z.number().int().positive() }),
);
const initializeResponse = monnifyEnvelope(
  z.object({
    transactionReference: z.string().min(1).max(160),
    paymentReference: z.string().min(1).max(120),
    checkoutUrl: z.url(),
  }),
);
const money = z.union([z.number().nonnegative().finite(), z.string().min(1).max(40)]);
const verifyResponse = monnifyEnvelope(
  z.object({
    transactionReference: z.string().min(1).max(160),
    paymentReference: z.string().min(1).max(120),
    amountPaid: money,
    paymentStatus: z.enum([
      "PAID",
      "PARTIALLY_PAID",
      "PENDING",
      "OVERPAID",
      "FAILED",
      "REVERSED",
      "EXPIRED",
    ]),
    currencyCode: z.string().length(3),
    paidOn: z.string().nullable().optional(),
    fee: money.nullable().optional(),
    paymentMethod: z.string().max(80).nullable().optional(),
  }),
);
const refundResponse = monnifyEnvelope(
  z.object({
    refundReference: z.string().min(1).max(160),
    refundStatus: z.string().min(1).max(80),
    refundAmount: money.optional(),
    currencyCode: z.string().length(3).optional(),
  }),
);

function parseProviderResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw providerUnavailable();
  return parsed.data;
}

type MonnifyMode = "disabled" | "sandbox" | "live";
type Fetch = typeof fetch;
export interface MonnifyAdapterOptions {
  mode: MonnifyMode;
  apiKey?: string;
  secretKey?: string;
  contractCode?: string;
  callbackUrl?: string;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  fetcher?: Fetch;
  now?: () => number;
}

function nairaToKobo(value: string | number): bigint {
  const normalized = typeof value === "number" ? String(value) : value.trim();
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) throw providerRejected();
  return BigInt(match[1]!) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
}

function koboToNaira(value: bigint): number {
  if (value <= 0n || value > 100_000_000_000_000_000n) throw providerRejected();
  return Number(value) / 100;
}

function checkoutUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.monnify.com" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== "" ||
    url.hash !== ""
  )
    throw providerRejected();
  return url.toString();
}

export class MonnifyAdapter implements PaymentProviderPort {
  private accessToken: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;
  private readonly options: MonnifyAdapterOptions;
  private readonly useRuntimeConfiguration: boolean;

  constructor(options?: MonnifyAdapterOptions) {
    this.useRuntimeConfiguration = options === undefined;
    this.options =
      options ??
      ({
        mode: env.MONNIFY_MODE,
        ...(env.MONNIFY_API_KEY ? { apiKey: env.MONNIFY_API_KEY } : {}),
        ...(env.MONNIFY_SECRET_KEY ? { secretKey: env.MONNIFY_SECRET_KEY } : {}),
        ...(env.MONNIFY_CONTRACT_CODE ? { contractCode: env.MONNIFY_CONTRACT_CODE } : {}),
        ...(env.MONNIFY_CALLBACK_URL ? { callbackUrl: env.MONNIFY_CALLBACK_URL } : {}),
        requestTimeoutMs: env.MONNIFY_REQUEST_TIMEOUT_MS,
        maxResponseBytes: env.MONNIFY_MAX_RESPONSE_BYTES,
      } satisfies MonnifyAdapterOptions);
  }

  private now(): number {
    return (this.options.now ?? Date.now)();
  }

  private baseUrl(): string {
    if (this.options.mode === "sandbox") return "https://sandbox.monnify.com";
    if (this.options.mode === "live") return "https://api.monnify.com";
    throw providerUnavailable();
  }

  private credentials(): Required<
    Pick<MonnifyAdapterOptions, "apiKey" | "secretKey" | "contractCode" | "callbackUrl">
  > {
    if (
      !this.options.apiKey ||
      !this.options.secretKey ||
      !this.options.contractCode ||
      !this.options.callbackUrl
    )
      throw providerUnavailable();
    if (this.useRuntimeConfiguration) assertMonnifyMode();
    return {
      apiKey: this.options.apiKey,
      secretKey: this.options.secretKey,
      contractCode: this.options.contractCode,
      callbackUrl: this.options.callbackUrl,
    };
  }

  private async readBounded(response: Response): Promise<unknown> {
    const declaredLength = Number(response.headers.get("content-length") ?? 0);
    if (declaredLength > this.options.maxResponseBytes)
      throw new Error("Provider response too large");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > this.options.maxResponseBytes)
      throw new Error("Provider response too large");
    return JSON.parse(bytes.toString("utf8")) as unknown;
  }

  private async request(
    path: string,
    init: RequestInit,
    authorization: string,
  ): Promise<unknown> {
    try {
      const response = await (this.options.fetcher ?? fetch)(`${this.baseUrl()}${path}`, {
        ...init,
        headers: {
          Authorization: authorization,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...init.headers,
        },
        redirect: "error",
        signal: AbortSignal.timeout(this.options.requestTimeoutMs),
      });
      const body = await this.readBounded(response);
      if (!response.ok) {
        if ([408, 425, 429].includes(response.status) || response.status >= 500)
          throw providerUnavailable();
        throw providerRejected();
      }
      return body;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw providerUnavailable(error);
    }
  }

  private async authenticate(): Promise<string> {
    const cached = this.accessToken;
    if (cached && cached.expiresAt - 60_000 > this.now()) return cached.value;
    if (this.tokenRequest) return this.tokenRequest;
    this.tokenRequest = (async () => {
      const credentials = this.credentials();
      const basic = Buffer.from(
        `${credentials.apiKey}:${credentials.secretKey}`,
        "utf8",
      ).toString("base64");
      const parsed = parseProviderResponse(
        authResponse,
        await this.request("/api/v1/auth/login", { method: "POST" }, `Basic ${basic}`),
      );
      if (!parsed.requestSuccessful) throw providerUnavailable();
      this.accessToken = {
        value: parsed.responseBody.accessToken,
        expiresAt: this.now() + parsed.responseBody.expiresIn * 1_000,
      };
      return parsed.responseBody.accessToken;
    })().finally(() => {
      this.tokenRequest = null;
    });
    return this.tokenRequest;
  }

  private async bearerRequest(path: string, init: RequestInit): Promise<unknown> {
    return this.request(path, init, `Bearer ${await this.authenticate()}`);
  }

  async initialize(command: InitializePaymentCommand): Promise<InitializedPayment> {
    const credentials = this.credentials();
    const parsed = parseProviderResponse(
      initializeResponse,
      await this.bearerRequest("/api/v1/merchant/transactions/init-transaction", {
        method: "POST",
        body: JSON.stringify({
          amount: koboToNaira(command.amountKobo),
          customerName: command.customerName ?? "Allied AutoTech Customer",
          customerEmail: command.email,
          paymentReference: command.reference,
          paymentDescription: "Allied AutoTech payment",
          currencyCode: command.currency,
          contractCode: credentials.contractCode,
          redirectUrl: command.callbackUrl ?? credentials.callbackUrl,
          paymentMethods: ["PAY_WITH_BANK"],
        }),
      }),
    );
    if (
      !parsed.requestSuccessful ||
      parsed.responseBody.paymentReference !== command.reference
    )
      throw providerRejected();
    return {
      authorizationUrl: checkoutUrl(parsed.responseBody.checkoutUrl),
      accessCode: parsed.responseBody.transactionReference,
      providerReference: parsed.responseBody.paymentReference,
      authorizationExpiresAt: new Date(this.now() + 40 * 60 * 1_000),
    };
  }

  async verify(reference: string): Promise<VerifiedPayment> {
    const query = new URLSearchParams({ paymentReference: reference });
    const parsed = parseProviderResponse(
      verifyResponse,
      await this.bearerRequest(`/api/v2/merchant/transactions/query?${query}`, {
        method: "GET",
      }),
    );
    if (!parsed.requestSuccessful) throw providerUnavailable();
    const data = parsed.responseBody;
    const status: VerifiedPayment["status"] = [
      "PAID",
      "PARTIALLY_PAID",
      "OVERPAID",
    ].includes(data.paymentStatus)
      ? "success"
      : data.paymentStatus === "EXPIRED"
        ? "abandoned"
        : ["FAILED", "REVERSED"].includes(data.paymentStatus)
          ? "failed"
          : "pending";
    const paidAt = data.paidOn ? new Date(data.paidOn) : null;
    if (paidAt && !Number.isFinite(paidAt.getTime())) throw providerRejected();
    return {
      reference: data.paymentReference,
      gatewayTransactionId: data.transactionReference,
      status,
      amountKobo: nairaToKobo(data.amountPaid),
      currency: data.currencyCode.toUpperCase(),
      paidAt,
      providerFeeKobo: data.fee == null ? null : nairaToKobo(data.fee),
      method: data.paymentMethod?.toLowerCase() ?? null,
    };
  }

  async refund(command: InitiateRefundCommand): Promise<InitiatedRefund> {
    const parsed = parseProviderResponse(
      refundResponse,
      await this.bearerRequest("/api/v1/refunds/initiate-refund", {
        method: "POST",
        body: JSON.stringify({
          transactionReference: command.gatewayTransactionId,
          refundReference: command.refundReference,
          refundAmount: koboToNaira(command.amountKobo),
          refundReason: command.reason.slice(0, 64),
          customerNote: command.customerNote.slice(0, 16),
        }),
      }),
    );
    if (!parsed.requestSuccessful) throw providerUnavailable();
    return {
      providerRefundId: parsed.responseBody.refundReference,
      status: parsed.responseBody.refundStatus,
    };
  }

  async verifyRefund(reference: string): Promise<VerifiedRefund> {
    const parsed = parseProviderResponse(
      refundResponse,
      await this.bearerRequest(`/api/v1/refunds/${encodeURIComponent(reference)}`, {
        method: "GET",
      }),
    );
    if (!parsed.requestSuccessful) throw providerUnavailable();
    const status = parsed.responseBody.refundStatus.toUpperCase();
    return {
      providerRefundId: parsed.responseBody.refundReference,
      status:
        status === "COMPLETED" ? "succeeded" : status === "FAILED" ? "failed" : "pending",
      amountKobo:
        parsed.responseBody.refundAmount === undefined
          ? null
          : nairaToKobo(parsed.responseBody.refundAmount),
      currency: parsed.responseBody.currencyCode?.toUpperCase() ?? null,
    };
  }
}

export const monnifyProvider = new MonnifyAdapter();
