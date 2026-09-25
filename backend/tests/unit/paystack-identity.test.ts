import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";
import { parsePaystackWebhook } from "../../src/providers/payments/paystack-webhook.js";

const ids = ["9007199254740992", "9007199254740993", "18446744073709551615"];
const originalMode = env.PAYSTACK_MODE;
const originalKey = env.PAYSTACK_SECRET_KEY;
beforeEach(() => {
  env.PAYSTACK_MODE = "test";
  env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_identity_only";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  env.PAYSTACK_MODE = originalMode;
  env.PAYSTACK_SECRET_KEY = originalKey;
  vi.unstubAllGlobals();
});

function webhook(event: string, id: string) {
  return Buffer.from(
    `{"event":"${event}","data":{"id":${id},"reference":"synthetic-reference","transaction":{"reference":"synthetic-reference"},"status":"success","amount":10000,"currency":"NGN"}}`,
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
        providerEventId: `${event}:${id}`,
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
