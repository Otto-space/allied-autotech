import { createHash, createHmac, randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { env } from "../../src/config/env.js";
import { prisma } from "../../src/config/database.js";
import { PaymentWebhookRetryWorker } from "../../src/workers/webhook-retry.worker.js";
import {
  disputeRecord,
  disputeRecordSelect,
  disputeRecordSchema,
} from "../../src/modules/payments/disputes.schemas.js";
const digest = () => createHash("sha256").update(randomUUID()).digest("hex");
type Provider = "PAYSTACK" | "MONNIFY";
async function fixture(provider: Provider) {
  const user = await prisma.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      passwordHash: "unusable",
      profile: {
        create: { firstName: "Refund", lastName: "Observation", phone: "+2348000000000" },
      },
    },
    include: { profile: true },
  });
  const branch = await prisma.branch.create({
    data: {
      code: randomUUID().slice(0, 8),
      name: "Refund test",
      address: "Test",
      city: "Test",
      state: "Test",
    },
  });
  const order = await prisma.order.create({
    data: {
      branchId: branch.id,
      customerId: user.profile!.id,
      orderNumber: randomUUID(),
      customerName: "Refund Observation",
      customerEmail: user.email,
      customerPhone: "+2348000000000",
      subtotalKobo: 10000n,
      totalKobo: 10000n,
    },
  });
  const payment = await prisma.payment.create({
    data: {
      customerId: user.profile!.id,
      orderId: order.id,
      paymentNumber: randomUUID(),
      purpose: "ORDER_PAYMENT",
      amountKobo: 10000n,
      idempotencyKeyHash: digest(),
    },
  });
  const attempt = await prisma.paymentAttempt.create({
    data: {
      paymentId: payment.id,
      attemptNumber: 1,
      internalReference: randomUUID(),
      provider,
      amountKobo: 10000n,
      status: "SUCCESSFUL",
      verificationStatus: "VERIFIED",
      verifiedAmountKobo: 10000n,
      verifiedCurrency: "NGN",
      gatewayTransactionId: randomUUID(),
      providerReference: randomUUID(),
      paidAt: new Date(),
      verifiedAt: new Date(),
    },
  });
  return { attempt };
}

describe.skipIf(process.env.RUN_DATABASE_TESTS !== "true")(
  "Verified Paystack dispute webhook",
  () => {
    const app = createApp({ checkReadiness: async () => undefined });
    const prior = { mode: env.PAYSTACK_MODE, key: env.PAYSTACK_SECRET_KEY };
    const hashes: string[] = [];
    beforeEach(() => {
      env.PAYSTACK_MODE = "test";
      env.PAYSTACK_SECRET_KEY = "sk_test_synthetic_dispute_contract";
      vi.stubGlobal("fetch", vi.fn());
    });
    afterEach(async () => {
      await prisma.paymentWebhookEvent.updateMany({
        where: { payloadSha256: { in: hashes }, status: { not: "PROCESSED" } },
        data: { status: "DEAD_LETTER", lockedAt: null, failedAt: new Date() },
      });
      hashes.length = 0;
      vi.unstubAllGlobals();
      env.PAYSTACK_MODE = prior.mode;
      env.PAYSTACK_SECRET_KEY = prior.key;
    });
    afterAll(() => prisma.$disconnect());
    async function setup() {
      const { attempt } = await fixture("PAYSTACK");
      const data = {
        id: randomUUID(),
        domain: "test",
        status: "resolved",
        resolution: "merchant-accepted" as string | null,
        refund_amount: 1200 as number | null,
        currency: "NGN",
        category: "general",
        dueAt: null,
        resolvedAt: new Date(Date.now() - 1000).toISOString() as string | null,
        updatedAt: new Date(Date.now() - 1000).toISOString(),
        transaction: {
          id: attempt.gatewayTransactionId,
          reference: attempt.internalReference,
          amount: 10000,
          currency: "NGN",
          domain: "test",
        },
      };
      const respond = (change: Record<string, unknown> = {}) =>
        vi.mocked(fetch).mockResolvedValue(
          new Response(
            JSON.stringify({
              status: true,
              message: "Synthetic",
              data: { ...data, ...change },
            }),
          ),
        );
      const send = async (
        event = "charge.dispute.resolve",
        change: Record<string, unknown> = {},
      ) => {
        const raw = JSON.stringify({ event, data: { id: data.id, ...change } });
        const hash = createHash("sha256").update(raw).digest("hex");
        hashes.push(hash);
        const response = await request(app)
          .post("/api/v1/webhooks/paystack")
          .set("Content-Type", "application/json")
          .set(
            "x-paystack-signature",
            createHmac("sha512", env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex"),
          )
          .send(raw);
        return {
          response,
          receipt: await prisma.paymentWebhookEvent.findFirstOrThrow({
            where: { payloadSha256: hash },
          }),
        };
      };
      const row = () =>
        prisma.paymentDispute.findUniqueOrThrow({
          where: {
            provider_providerDisputeId: {
              provider: "PAYSTACK",
              providerDisputeId: data.id,
            },
          },
        });
      return { attempt, data, respond, send, row };
    }
    it("records the provider-confirmed partial loss once and exposes it without private evidence", async () => {
      const f = await setup();
      f.respond();
      const first = await f.send();
      expect(first.response.status).toBe(200);
      expect(first.receipt.status).toBe("PROCESSED");
      expect(await f.row()).toMatchObject({
        status: "ACCEPTED",
        amountKobo: 10000n,
        chargebackAmountKobo: 1200n,
        providerStatus: "resolved",
        providerResolution: "merchant-accepted",
      });
      const row = await f.row();
      expect(
        await prisma.paymentLedgerEntry.findMany({ where: { disputeId: row.id } }),
      ).toMatchObject([{ amountKobo: 1200n, type: "CHARGEBACK" }]);
      await f.send();
      expect(fetch).toHaveBeenCalledTimes(1);
      const dto = disputeRecord(
        await prisma.paymentDispute.findUniqueOrThrow({
          where: { id: row.id },
          select: disputeRecordSelect,
        }),
      );
      expect(disputeRecordSchema.parse(JSON.parse(JSON.stringify(dto)))).toMatchObject({
        chargebackAmountKobo: "1200",
        providerReviewReason: null,
      });
      expect(dto).not.toHaveProperty("evidenceObjectKey");
    });
    it.each([
      { resolution: "declined" },
      { resolution: "unknown" },
      { refund_amount: null },
      { resolvedAt: null },
    ])("retains ambiguous facts for review: %j", async (change) => {
      const f = await setup();
      f.respond(change);
      expect((await f.send()).response.status).toBe(200);
      const row = await f.row();
      expect(row).toMatchObject({
        status: "UNDER_REVIEW",
        resolvedAt: null,
        chargebackAmountKobo: null,
      });
      expect(row.providerReviewReason).not.toBeNull();
      expect(
        await prisma.paymentLedgerEntry.count({ where: { disputeId: row.id } }),
      ).toBe(0);
    });
    it.each(["identity", "amount", "currency", "future"])(
      "retains a %s conflict without financial writes",
      async (kind) => {
        const f = await setup();
        f.respond(
          kind === "future"
            ? { resolvedAt: new Date(Date.now() + 86400000).toISOString() }
            : {
                transaction: {
                  ...f.data.transaction,
                  ...(kind === "identity"
                    ? { id: "other" }
                    : kind === "amount"
                      ? { amount: 9000 }
                      : { currency: "USD" }),
                },
                ...(kind === "currency" ? { currency: "USD" } : {}),
              },
        );
        const { receipt } = await f.send();
        expect(receipt).toMatchObject({
          status: "FAILED",
          lastErrorCode: "DISPUTE_VERIFICATION_CONFLICT",
        });
        expect(
          await prisma.paymentDispute.count({
            where: { paymentAttemptId: f.attempt.id },
          }),
        ).toBe(0);
        expect(
          await prisma.paymentAnomaly.count({
            where: { paymentAttemptId: f.attempt.id },
          }),
        ).toBe(1);
      },
    );
    it("re-fetches durable receipts, including legacy events, before applying a retry", async () => {
      const f = await setup();
      vi.mocked(fetch).mockRejectedValue(new Error("synthetic outage"));
      const first = await f.send();
      expect(first.response.status).toBe(503);
      const payload = first.receipt.redactedPayload as Record<string, unknown>;
      delete payload.disputeLookupRequired;
      await prisma.paymentWebhookEvent.update({
        where: { id: first.receipt.id },
        data: {
          status: "RECEIVED",
          nextAttemptAt: null,
          redactedPayload: payload as never,
        },
      });
      f.respond();
      await new PaymentWebhookRetryWorker().runOnce(100);
      expect(await f.row()).toMatchObject({
        status: "ACCEPTED",
        chargebackAmountKobo: 1200n,
      });
      expect(
        await prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: { id: first.receipt.id },
        }),
      ).toMatchObject({ status: "PROCESSED" });
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("processes changed reminders and ignores older provider snapshots", async () => {
      const f = await setup();
      const recent = new Date(Date.now() - 10000).toISOString();
      f.respond({
        status: "awaiting-merchant-feedback",
        resolution: null,
        refund_amount: null,
        resolvedAt: null,
        updatedAt: recent,
      });
      await f.send("charge.dispute.remind", { updatedAt: recent });
      expect(await f.row()).toMatchObject({ status: "AWAITING_RESPONSE" });
      f.respond({
        status: "pending",
        resolution: null,
        refund_amount: null,
        resolvedAt: null,
      });
      await f.send("charge.dispute.remind", { updatedAt: f.data.updatedAt });
      const before = await f.row();
      expect(before.status).toBe("UNDER_REVIEW");
      f.respond({ updatedAt: recent });
      await f.send("charge.dispute.resolve");
      expect(await f.row()).toEqual(before);
      expect(
        await prisma.paymentLedgerEntry.count({ where: { disputeId: before.id } }),
      ).toBe(0);
    });
    it("preserves an accepted loss and flags a later conflicting amount", async () => {
      const f = await setup();
      f.respond();
      await f.send();
      const before = await f.row();
      f.respond({ refund_amount: 3000 });
      await f.send("charge.dispute.resolve", { updatedAt: new Date().toISOString() });
      expect(await f.row()).toEqual(before);
      expect(await prisma.paymentAnomaly.count({ where: { disputeId: before.id } })).toBe(
        1,
      );
      expect(
        await prisma.paymentLedgerEntry.findMany({ where: { disputeId: before.id } }),
      ).toMatchObject([{ amountKobo: 1200n }]);
      await expect(
        prisma.paymentDispute.update({
          where: { id: before.id },
          data: { chargebackAmountKobo: 3000n },
        }),
      ).rejects.toThrow();
    });
    it.each([
      ["resolved", "merchant-accepted", 10000, "ACCEPTED"],
      ["lost", null, 2000, "LOST"],
      ["won", null, 0, "WON"],
      ["expired", null, 0, "EXPIRED"],
    ] as const)(
      "records explicit %s outcome with the correct financial effect",
      async (status, resolution, amount, expected) => {
        const f = await setup();
        f.respond({ status, resolution, refund_amount: amount });
        await f.send();
        const row = await f.row();
        expect(row.status).toBe(expected);
        expect(row.resolvedAt?.toISOString()).toBe(f.data.resolvedAt);
        const ledger = await prisma.paymentLedgerEntry.findMany({
          where: { disputeId: row.id },
        });
        expect(ledger).toHaveLength(amount > 0 ? 1 : 0);
        if (amount > 0)
          expect(ledger[0]).toMatchObject({
            amountKobo: BigInt(amount),
            occurredAt: row.resolvedAt,
          });
      },
    );
    it("does not substitute a conflicting webhook reference with another captured payment", async () => {
      const f = await setup();
      f.respond();
      const { receipt } = await f.send("charge.dispute.resolve", {
        transaction: { reference: "different-reference" },
      });
      expect(receipt).toMatchObject({
        status: "FAILED",
        lastErrorCode: "DISPUTE_VERIFICATION_CONFLICT",
      });
      expect(
        await prisma.paymentDispute.count({ where: { paymentAttemptId: f.attempt.id } }),
      ).toBe(0);
    });
  },
);
