import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  openPaymentCheckoutState,
  sealPaymentCheckoutState,
} from "../../src/common/security/payment-checkout-state.js";
import { assertMonnifyMode, env } from "../../src/config/env.js";
import {
  monnifyPayloadSha256,
  parseMonnifyWebhook,
  verifyMonnifySignature,
} from "../../src/providers/payments/monnify-webhook.js";
import { MonnifyAdapter } from "../../src/providers/payments/monnify.adapter.js";

const jsonResponse = (value: unknown) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("Monnify payment security", () => {
  it("uses hosted Pay-with-Bank, fixed provider hosts, bounded responses, and cached auth", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const responses = [
      {
        requestSuccessful: true,
        responseMessage: "success",
        responseCode: "0",
        responseBody: {
          accessToken: "synthetic-access-token-long-enough",
          expiresIn: 3600,
        },
      },
      {
        requestSuccessful: true,
        responseMessage: "success",
        responseCode: "0",
        responseBody: {
          transactionReference: "MNFY|synthetic|1",
          paymentReference: "AAT-MONNIFY-reference",
          checkoutUrl: "https://checkout.monnify.com/pay/synthetic",
        },
      },
      {
        requestSuccessful: true,
        responseMessage: "success",
        responseCode: "0",
        responseBody: {
          transactionReference: "MNFY|synthetic|1",
          paymentReference: "AAT-MONNIFY-reference",
          amountPaid: 123.45,
          totalPayable: 123.45,
          settlementAmount: 121.45,
          paymentStatus: "PAID",
          paymentMethod: "ACCOUNT_TRANSFER",
          currencyCode: "NGN",
          paidOn: "2026-09-11T12:00:00.000Z",
          fee: 2,
          paymentSourceInformation: [
            { accountNumber: "never-retain", accountName: "never-retain" },
          ],
        },
      },
    ];
    const adapter = new MonnifyAdapter({
      mode: "sandbox",
      apiKey: "MK_TEST_synthetic",
      secretKey: "SK_TEST_synthetic",
      contractCode: "synthetic-contract",
      callbackUrl: "https://app.example.test/payments/complete",
      requestTimeoutMs: 2_000,
      maxResponseBytes: 16_384,
      now: () => new Date("2026-09-11T11:50:00.000Z").getTime(),
      fetcher: async (input, init) => {
        calls.push({ url: String(input), init });
        return jsonResponse(responses.shift());
      },
    });
    const initialized = await adapter.initialize({
      email: "synthetic@example.test",
      customerName: "Synthetic Customer",
      amountKobo: 12_345n,
      currency: "NGN",
      reference: "AAT-MONNIFY-reference",
    });
    const verified = await adapter.verify("AAT-MONNIFY-reference");
    expect(initialized).toMatchObject({
      authorizationUrl: "https://checkout.monnify.com/pay/synthetic",
      providerReference: "AAT-MONNIFY-reference",
    });
    expect(verified).toMatchObject({
      amountKobo: 12_345n,
      currency: "NGN",
      status: "success",
      method: "account_transfer",
    });
    expect(calls).toHaveLength(3);
    expect(calls.filter(({ url }) => url.endsWith("/api/v1/auth/login"))).toHaveLength(1);
    const initializationBody = JSON.parse(String(calls[1]?.init?.body)) as Record<
      string,
      unknown
    >;
    expect(initializationBody).toMatchObject({
      amount: 123.45,
      paymentMethods: ["PAY_WITH_BANK"],
      currencyCode: "NGN",
    });
    expect(JSON.stringify(initializationBody)).not.toMatch(/accountNumber|otp/iu);
    expect(calls.every(({ url }) => url.startsWith("https://sandbox.monnify.com/"))).toBe(
      true,
    );
  });

  it("encrypts checkout URLs and provider access state at rest", () => {
    const state = {
      provider: "MONNIFY" as const,
      authorizationUrl: "https://checkout.monnify.com/pay/private-value",
      accessCode: "MNFY|private-provider-reference",
      expiresAt: "2026-09-11T12:30:00.000Z",
    };
    const encrypted = sealPaymentCheckoutState(state);
    expect(JSON.stringify(encrypted)).not.toContain(state.authorizationUrl);
    expect(JSON.stringify(encrypted)).not.toContain(state.accessCode);
    expect(openPaymentCheckoutState(encrypted)).toEqual(state);
  });

  it("verifies exact raw webhook bytes and retains only allowlisted facts", () => {
    const secret = "SK_TEST_synthetic-webhook-secret";
    const raw = Buffer.from(
      JSON.stringify({
        eventType: "SUCCESSFUL_TRANSACTION",
        eventData: {
          transactionReference: "MNFY|synthetic|1",
          paymentReference: "AAT-MONNIFY-reference",
          paymentStatus: "PAID",
          amountPaid: 123.45,
          currency: "NGN",
          paymentMethod: "ACCOUNT_TRANSFER",
          paidOn: "2026-09-11T12:00:00.000Z",
          paymentSourceInformation: [
            { accountNumber: "0123456789", accountName: "Sensitive Name" },
          ],
        },
      }),
    );
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    expect(verifyMonnifySignature(raw, signature, secret)).toBe(true);
    expect(
      verifyMonnifySignature(Buffer.concat([raw, Buffer.from(" ")]), signature, secret),
    ).toBe(false);
    expect(monnifyPayloadSha256(raw)).toMatch(/^[0-9a-f]{64}$/u);
    expect(parseMonnifyWebhook(raw)).toEqual({
      kind: "transaction",
      eventType: "SUCCESSFUL_TRANSACTION",
      providerEventId: "SUCCESSFUL_TRANSACTION:MNFY|synthetic|1",
      reference: "AAT-MONNIFY-reference",
      gatewayTransactionId: "MNFY|synthetic|1",
      status: "PAID",
      amountKobo: 12_345n,
      currency: "NGN",
      paidAt: new Date("2026-09-11T12:00:00.000Z"),
      providerFeeKobo: null,
      method: "account_transfer",
    });
    expect(parseMonnifyWebhook(raw)).not.toHaveProperty("paymentSourceInformation");
  });

  it("fails closed for staging and live provider configuration", () => {
    expect(() =>
      assertMonnifyMode({
        ...env,
        DEPLOYMENT_ENV: "staging",
        MONNIFY_MODE: "disabled",
      }),
    ).toThrow("Staging requires MONNIFY_MODE=sandbox");
    expect(() =>
      assertMonnifyMode({
        ...env,
        DEPLOYMENT_ENV: "staging",
        MONNIFY_MODE: "sandbox",
        MONNIFY_API_KEY: "MK_TEST_synthetic",
        MONNIFY_SECRET_KEY: "SK_TEST_synthetic",
        MONNIFY_CONTRACT_CODE: "synthetic-contract",
        MONNIFY_CALLBACK_URL: "https://app.example.test/payments/complete",
      }),
    ).not.toThrow();
    expect(() =>
      assertMonnifyMode({
        ...env,
        DEPLOYMENT_ENV: "production",
        MONNIFY_MODE: "live",
        MONNIFY_LIVE_ENABLED: false,
        MONNIFY_API_KEY: "MK_PROD_synthetic",
        MONNIFY_SECRET_KEY: "SK_PROD_synthetic",
        MONNIFY_CONTRACT_CODE: "synthetic-contract",
        MONNIFY_CALLBACK_URL: "https://app.example.test/payments/complete",
      }),
    ).toThrow(/explicitly enabled production deployment/u);
  });
});
