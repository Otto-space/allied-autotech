import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { env } from "../../src/config/env.js";
import { PaystackAdapter } from "../../src/providers/payments/paystack.adapter.js";
import { parsePaystackWebhook } from "../../src/providers/payments/paystack-webhook.js";
import {
  disputeOutcome,
  paystackDisputeSchema,
  verifiedDispute,
} from "../../src/providers/payments/paystack-dispute.js";
const sample = () => ({
  id: "9007199254740993",
  domain: "test",
  status: "resolved",
  resolution: "merchant-accepted",
  refund_amount: 1002,
  currency: "NGN",
  category: "general",
  transaction: {
    id: "9007199254740994",
    reference: "synthetic-reference",
    amount: 39100,
    currency: "NGN",
    domain: "test",
  },
  resolvedAt: "2026-10-12T08:00:00.000Z",
  updatedAt: "2026-10-12T08:00:00.000Z",
  dueAt: null,
});
const prior = { mode: env.PAYSTACK_MODE, key: env.PAYSTACK_SECRET_KEY };
beforeEach(() => {
  env.PAYSTACK_MODE = "test";
  env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_dispute";
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  env.PAYSTACK_MODE = prior.mode;
  env.PAYSTACK_SECRET_KEY = prior.key;
  vi.unstubAllGlobals();
});
describe("Paystack dispute provider contract", () => {
  it("accepts documented dispute facts without a fabricated top-level amount", () => {
    const parsed = parsePaystackWebhook(
      Buffer.from(JSON.stringify({ event: "charge.dispute.resolve", data: sample() })),
    );
    expect(parsed).toMatchObject({
      resourceId: sample().id,
      reference: "synthetic-reference",
      disputeLookupRequired: true,
    });
  });
  it("keeps distinct reminders while deduplicating the same raw event", () => {
    const body = (updatedAt: string) =>
      Buffer.from(
        JSON.stringify({
          event: "charge.dispute.remind",
          data: { ...sample(), status: "awaiting-merchant-feedback", updatedAt },
        }),
      );
    const a = parsePaystackWebhook(body("2026-10-12T08:00:00.000Z")),
      b = parsePaystackWebhook(body("2026-10-12T12:00:00.000Z"));
    expect(a.providerEventId).not.toBe(b.providerEventId);
    expect(parsePaystackWebhook(body("2026-10-12T08:00:00.000Z")).providerEventId).toBe(
      a.providerEventId,
    );
  });
  it("fetches the exact dispute and retains partial loss independently of the captured total", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ status: true, message: "Synthetic", data: sample() }),
      ),
    );
    const result = await new PaystackAdapter().verifyDispute(sample().id);
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe(
      `https://api.paystack.co/dispute/${sample().id}`,
    );
    expect(result).toMatchObject({
      transactionAmountKobo: 39100n,
      refundAmountKobo: 1002n,
      gatewayTransactionId: sample().transaction.id,
    });
    expect(disputeOutcome(result)).toEqual({
      status: "ACCEPTED",
      chargebackAmountKobo: 1002n,
      reviewReason: null,
    });
  });
  it.each([
    { id: "other" },
    { domain: "live" },
    { refund_amount: 40000 },
    { currency: "USD" },
    { resolvedAt: "invalid" },
  ])("rejects mismatched or invalid provider facts %j", async (change) => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: "Synthetic",
          data: { ...sample(), ...change },
        }),
      ),
    );
    await expect(new PaystackAdapter().verifyDispute(sample().id)).rejects.toMatchObject({
      statusCode: 503,
    });
  });
  it.each(["awaiting-merchant-feedback", "awaiting-bank-feedback", "pending"])(
    "maps %s without claiming a loss",
    (status) => {
      const result = disputeOutcome(
        verifiedDispute(
          paystackDisputeSchema.parse({
            ...sample(),
            status,
            resolution: null,
            refund_amount: null,
            resolvedAt: null,
          }),
        ),
      );
      expect(result).toEqual({
        status:
          status === "awaiting-merchant-feedback" ? "AWAITING_RESPONSE" : "UNDER_REVIEW",
        chargebackAmountKobo: null,
        reviewReason: null,
      });
    },
  );
  it.each([
    { resolution: "declined" },
    { resolution: "unrecognized" },
    { refund_amount: null },
    { refund_amount: 0 },
    { resolvedAt: null },
  ])("keeps ambiguous resolution under review %j", (change) => {
    const result = disputeOutcome(
      verifiedDispute(paystackDisputeSchema.parse({ ...sample(), ...change })),
    );
    expect(result).toMatchObject({ status: "UNDER_REVIEW", chargebackAmountKobo: null });
    expect(result.reviewReason).not.toBeNull();
  });
});
