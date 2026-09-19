import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { AuthenticatedActor } from "../../src/common/contracts/actor.js";
import {
  assertPaymentApprover,
  assertPaymentCustomer,
  assertPaymentOperator,
} from "../../src/modules/payments/payments.policy.js";
import {
  manualPaymentBodySchema,
  paymentCreateBodySchema,
  refundCreateBodySchema,
} from "../../src/modules/payments/payments.schemas.js";
import { paymentJsonSafe } from "../../src/modules/payments/payments.types.js";
import {
  parsePaystackWebhook,
  paystackPayloadSha256,
  verifyPaystackSignature,
} from "../../src/providers/payments/paystack-webhook.js";
import {
  issuePaymentEvidenceTicket,
  readPaymentEvidenceTicket,
} from "../../src/common/security/payment-evidence-tickets.js";

const actor = (
  role: AuthenticatedActor["role"],
  verified = role !== "CUSTOMER",
): AuthenticatedActor => ({
  userId: crypto.randomUUID(),
  sessionId: crypto.randomUUID(),
  email: "actor@example.test",
  role,
  mfaRequired: role !== "CUSTOMER",
  mfaVerifiedAt: verified ? new Date() : null,
});

describe("Phase 8 payment security contracts", () => {
  it("defaults customer, operator, and approver policies to deny", () => {
    expect(() => assertPaymentCustomer(actor("CUSTOMER"))).not.toThrow();
    expect(() => assertPaymentCustomer(actor("STAFF"))).toThrow();
    expect(() => assertPaymentOperator(actor("STAFF", false))).toThrow();
    expect(() => assertPaymentOperator(actor("STAFF"))).toThrow();
    expect(() => assertPaymentOperator(actor("ADMIN", false))).toThrow();
    expect(() => assertPaymentOperator(actor("ADMIN"))).not.toThrow();
    expect(() => assertPaymentOperator(actor("SUPER_ADMIN"))).not.toThrow();
    expect(() => assertPaymentApprover(actor("STAFF"))).toThrow();
    expect(() => assertPaymentApprover(actor("ADMIN", false))).toThrow();
    expect(() => assertPaymentApprover(actor("SUPER_ADMIN"))).not.toThrow();
  });

  it("accepts only target-compatible purposes and server-owned amounts", () => {
    expect(
      paymentCreateBodySchema.safeParse({
        targetType: "ORDER",
        targetId: crypto.randomUUID(),
        purpose: "ORDER_PAYMENT",
      }).success,
    ).toBe(true);
    expect(
      paymentCreateBodySchema.safeParse({
        targetType: "ORDER",
        targetId: crypto.randomUUID(),
        purpose: "VEHICLE_FULL_PAYMENT",
        amountKobo: "1",
      }).success,
    ).toBe(false);
    expect(
      refundCreateBodySchema.safeParse({
        paymentAttemptId: crypto.randomUUID(),
        amountKobo: "0",
        reason: "Duplicate",
      }).success,
    ).toBe(false);
  });

  it("requires paired manual-payment evidence metadata", () => {
    const base = {
      method: "BANK_TRANSFER",
      payerName: "Test Customer",
      transferredAt: new Date().toISOString(),
    };
    expect(manualPaymentBodySchema.safeParse(base).success).toBe(true);
    expect(
      manualPaymentBodySchema.safeParse({ ...base, evidenceObjectKey: "private/key" })
        .success,
    ).toBe(false);
    expect(
      manualPaymentBodySchema.safeParse({ ...base, evidenceToken: "x".repeat(100) })
        .success,
    ).toBe(true);
  });

  it("binds encrypted evidence capabilities to the actor and payment", () => {
    const issued = issuePaymentEvidenceTicket({
      actorUserId: crypto.randomUUID(),
      paymentId: crypto.randomUUID(),
      mimeType: "application/pdf",
      sizeBytes: 100,
      checksumSha256: "a".repeat(64),
    });
    expect(Buffer.from(issued.ticket, "base64url").toString("utf8")).not.toContain(
      issued.payload.objectKey,
    );
    expect(readPaymentEvidenceTicket(issued.ticket)).toEqual(issued.payload);
    expect(() => readPaymentEvidenceTicket(`${issued.ticket.slice(0, -1)}A`)).toThrow();
  });

  it("verifies webhook signatures over exact raw bytes and rejects tampering", () => {
    const secret = "test-only-webhook-key";
    const raw = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: {
          id: 42,
          reference: "AAT-ref",
          status: "success",
          amount: 12500,
          currency: "NGN",
          paid_at: "2026-09-06T08:00:00.000Z",
          fees: 200,
          channel: "card",
        },
      }),
    );
    const signature = createHmac("sha512", secret).update(raw).digest("hex");
    expect(verifyPaystackSignature(raw, signature, secret)).toBe(true);
    expect(
      verifyPaystackSignature(Buffer.concat([raw, Buffer.from(" ")]), signature, secret),
    ).toBe(false);
    expect(verifyPaystackSignature(raw, "invalid", secret)).toBe(false);
    expect(paystackPayloadSha256(raw)).toMatch(/^[0-9a-f]{64}$/);
    expect(parsePaystackWebhook(raw)).toMatchObject({
      eventType: "charge.success",
      reference: "AAT-ref",
      amountKobo: 12500n,
      currency: "NGN",
    });
  });

  it("rejects malformed provider payloads and serializes money safely", () => {
    expect(() =>
      parsePaystackWebhook(
        Buffer.from('{"event":"charge.success","data":{"amount":-1}}'),
      ),
    ).toThrow();
    expect(paymentJsonSafe({ amountKobo: 100n })).toEqual({ amountKobo: "100" });
  });

  it("allowlists refund, dispute, and ignored webhook shapes", () => {
    const refund = parsePaystackWebhook(
      Buffer.from(
        JSON.stringify({
          event: "refund.processed",
          data: { id: 7, status: "processed", amount: 500, currency: "ngn" },
        }),
      ),
    );
    expect(refund).toMatchObject({
      eventType: "refund.processed",
      resourceId: "7",
      amountKobo: 500n,
      currency: "NGN",
    });
    const dispute = parsePaystackWebhook(
      Buffer.from(
        JSON.stringify({
          event: "charge.dispute.create",
          data: {
            id: "d-1",
            status: "awaiting_response",
            amount: 500,
            currency: "NGN",
            category: "fraud",
            dueAt: "2026-09-07T00:00:00.000Z",
            transaction: { reference: "AAT-ref" },
          },
        }),
      ),
    );
    expect(dispute).toMatchObject({
      resourceId: "d-1",
      reference: "AAT-ref",
      category: "fraud",
    });
    expect(dispute.responseDueAt).toBeInstanceOf(Date);
    expect(
      parsePaystackWebhook(
        Buffer.from(JSON.stringify({ event: "subscription.create", data: {} })),
      ),
    ).toMatchObject({
      eventType: "subscription.create",
      resourceId: null,
      reference: null,
    });
    const minimalCharge = parsePaystackWebhook(
      Buffer.from(
        JSON.stringify({
          event: "charge.success",
          data: {
            id: 8,
            reference: "minimal",
            status: "success",
            amount: 1,
            currency: "NGN",
          },
        }),
      ),
    );
    expect(minimalCharge).toMatchObject({
      paidAt: null,
      providerFeeKobo: null,
      method: null,
    });
    const minimalDispute = parsePaystackWebhook(
      Buffer.from(
        JSON.stringify({
          event: "charge.dispute.create",
          data: {
            id: 9,
            status: "under_review",
            amount: 1,
            currency: "NGN",
            transaction: { reference: "minimal" },
          },
        }),
      ),
    );
    expect(minimalDispute).toMatchObject({ category: null, responseDueAt: null });
    const now = new Date();
    expect(paymentJsonSafe([1n, now, null, "value"])).toEqual(["1", now, null, "value"]);
  });
});
