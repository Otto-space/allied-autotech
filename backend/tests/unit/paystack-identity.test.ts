import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";
import { parsePaystackWebhook } from "../../src/providers/payments/paystack-webhook.js";

const ids = ["9007199254740992", "9007199254740993", "18446744073709551615"];
const originalMode = env.PAYSTACK_MODE;
const originalKey = env.PAYSTACK_SECRET_KEY;
const originalDeployment = env.DEPLOYMENT_ENV;
const originalLiveEnabled = env.PAYSTACK_LIVE_ENABLED;
beforeEach(() => {
  env.PAYSTACK_MODE = "test";
  env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_identity_only";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  env.PAYSTACK_MODE = originalMode;
  env.PAYSTACK_SECRET_KEY = originalKey;
  env.DEPLOYMENT_ENV = originalDeployment;
  env.PAYSTACK_LIVE_ENABLED = originalLiveEnabled;
  vi.unstubAllGlobals();
});

function webhook(event: string, id: string) {
  return Buffer.from(
    `{"event":"${event}","data":{"id":${id},"domain":"test","reference":"synthetic-reference","transaction":{"reference":"synthetic-reference"},"status":"success","amount":10000,"currency":"NGN"}}`,
  );
}
function response(id: string) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(
      `{"status":true,"message":"Synthetic","data":{"id":${id},"domain":"test","reference":"synthetic-reference","status":"success","amount":10000,"currency":"NGN"}}`,
    ),
  );
}

describe("exact Paystack transaction identity", () => {
  for (const event of ["charge.success", "refund.processed", "charge.dispute.create"])
    it.each(ids)(`${event} preserves numeric ID %s without rounding`, (id) => {
      expect(parsePaystackWebhook(webhook(event, id))).toMatchObject({
        resourceId: id,
        ...(event.startsWith("charge.dispute.")
          ? { disputeLookupRequired: true }
          : { providerEventId: `${event}:${id}` }),
        ...(event === "charge.success" ? { gatewayTransactionId: id } : {}),
      });
    });
  it.each(ids)("authoritative verification preserves numeric ID %s", async (id) => {
    response(id);
    expect(await new PaystackAdapter().verify("synthetic-reference")).toMatchObject({
      gatewayTransactionId: id,
    });
  });
  it.each(ids)("refund lookup preserves numeric ID %s", async (id) => {
    response(id);
    expect(await new PaystackAdapter().verifyRefund("synthetic-refund")).toMatchObject({
      providerRefundId: id,
    });
  });
  it.each(ids)("refund acknowledgement preserves numeric ID %s", async (id) => {
    response(id);
    expect(
      await new PaystackAdapter().refund({
        gatewayTransactionId: "42",
        amountKobo: 10000n,
        currency: "NGN",
        refundReference: "synthetic-refund",
        reason: "Synthetic test",
        customerNote: "Synthetic",
      }),
    ).toMatchObject({ providerRefundId: id });
  });
  it.each(['""', '"   "', "1.5", "-1", "9007199254740993e0"])(
    "rejects unusable identity %s in webhooks and verification",
    async (id) => {
      expect(() => parsePaystackWebhook(webhook("charge.success", id))).toThrow();
      response(id);
      await expect(new PaystackAdapter().verify("synthetic-reference")).rejects.toThrow();
    },
  );
  it("preserves a string identity and leaves monetary validation strict", async () => {
    const id = ids[2]!;
    expect(
      parsePaystackWebhook(webhook("charge.success", JSON.stringify(id))),
    ).toMatchObject({ gatewayTransactionId: id });
    const raw = webhook("charge.success", id)
      .toString("utf8")
      .replace('"amount":10000', '"amount":9007199254740993');
    expect(() => parsePaystackWebhook(Buffer.from(raw))).toThrow();
    response(JSON.stringify(id));
    expect(await new PaystackAdapter().verify("synthetic-reference")).toMatchObject({
      gatewayTransactionId: id,
    });
  });
});

describe("Paystack verification environment and reference", () => {
  it.each([
    { domain: undefined },
    { domain: null },
    { domain: "live" },
    { domain: "unknown" },
    { reference: "another-payment" },
  ])("rejects incomplete or mismatched verification: %j", async (change) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: "Synthetic",
          data: {
            id: 42,
            domain: "test",
            reference: "synthetic-reference",
            status: "success",
            amount: 10000,
            currency: "NGN",
            ...change,
          },
        }),
      ),
    );
    await expect(new PaystackAdapter().verify("synthetic-reference")).rejects.toThrow();
  });

  it("accepts a matching live response only with live configuration", async () => {
    env.PAYSTACK_MODE = "live";
    env.DEPLOYMENT_ENV = "production";
    env.PAYSTACK_LIVE_ENABLED = true;
    env.PAYSTACK_SECRET_KEY = "sk_live_synthetic_contract_only";
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: "Synthetic",
          data: {
            id: 42,
            domain: "live",
            reference: "synthetic-reference",
            status: "success",
            amount: 10000,
            currency: "NGN",
          },
        }),
      ),
    );
    await expect(
      new PaystackAdapter().verify("synthetic-reference"),
    ).resolves.toMatchObject({
      reference: "synthetic-reference",
      status: "success",
      amountKobo: 10000n,
    });
  });
});

describe("Paystack successful charge event consistency", () => {
  it.each(["failed", "pending", "abandoned", "reversed"])(
    "rejects a charge.success envelope whose transaction status is %s",
    (status) => {
      const raw = webhook("charge.success", "42")
        .toString("utf8")
        .replace('"status":"success"', `"status":"${status}"`);
      expect(() => parsePaystackWebhook(Buffer.from(raw))).toThrow();
    },
  );
});

it.each([undefined, null, "unknown"])(
  "rejects a charge event without a recognised domain: %s",
  (domain) => {
    const data = {
      id: 42,
      domain,
      reference: "synthetic-reference",
      status: "success",
      amount: 10000,
      currency: "NGN",
    };
    expect(() =>
      parsePaystackWebhook(
        Buffer.from(JSON.stringify({ event: "charge.success", data })),
      ),
    ).toThrow();
  },
);

it.each([
  "reversed",
  "failed",
  "abandoned",
  "pending",
  "ongoing",
  "processing",
  "queued",
])(
  "preserves the authoritative %s outcome without treating it as success",
  async (status) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: "Synthetic",
          data: {
            id: 42,
            domain: "test",
            reference: "synthetic-reference",
            status,
            amount: 10000,
            currency: "NGN",
          },
        }),
      ),
    );
    await expect(
      new PaystackAdapter().verify("synthetic-reference"),
    ).resolves.toMatchObject({
      reference: "synthetic-reference",
      amountKobo: 10000n,
      status: ["ongoing", "processing", "queued"].includes(status) ? "pending" : status,
    });
  },
);
