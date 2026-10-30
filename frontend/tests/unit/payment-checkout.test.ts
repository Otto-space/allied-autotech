import { describe, expect, it } from "vitest";
import {
  newPaymentAttemptUnavailable,
  paymentDeadlineUnavailable,
  paymentIdentity,
  validatedCheckout,
} from "../../lib/api/payment-checkout";
import type { PaymentRecord } from "../../lib/api/payment-schemas";
const id = (n: number) => `c9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const now = Date.parse("2026-10-08T10:00:00Z");
const payment: PaymentRecord = {
  id: id(1),
  paymentNumber: "TEST",
  amountKobo: "7663750",
  currency: "NGN",
  status: "REQUIRES_PAYMENT",
  purpose: "ORDER_PAYMENT",
  expiresAt: "2026-10-08T11:00:00Z",
  orderId: id(2),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [],
  checkoutProviders: ["PAYSTACK"],
};
const checkout = {
  attemptId: id(3),
  authorizationUrl: "https://checkout.paystack.com/synthetic",
  authorizationExpiresAt: "2026-10-08T11:00:00Z",
};
describe("payment checkout boundaries", () => {
  it("allows an unpaid eligible request with a valid or absent deadline", () => {
    expect(newPaymentAttemptUnavailable(payment, now)).toBeUndefined();
    expect(
      newPaymentAttemptUnavailable({ ...payment, expiresAt: null }, now),
    ).toBeUndefined();
  });
  it.each(["", "invalid", "2026-10-08", "2026-10-08T10:00:00Z", "2026-10-08T09:59:59Z"])(
    "rejects unverified or elapsed deadline %s",
    (expiresAt) => {
      expect(paymentDeadlineUnavailable({ ...payment, expiresAt }, now)).toBeTruthy();
    },
  );
  it("prevents booking deposits, zero amounts and completed requests", () => {
    expect(
      newPaymentAttemptUnavailable({ ...payment, bookingId: id(5) }, now),
    ).toBeTruthy();
    expect(
      newPaymentAttemptUnavailable({ ...payment, amountKobo: "0" }, now),
    ).toBeTruthy();
    expect(
      newPaymentAttemptUnavailable({ ...payment, status: "SUCCEEDED" }, now),
    ).toBeTruthy();
  });
  it("blocks unresolved attempts but permits a new attempt after a recorded failure", () => {
    const attempt: PaymentRecord["attempts"][number] = {
      id: id(3),
      provider: "PAYSTACK",
      status: "PENDING",
      verificationStatus: "PENDING",
      initiatedAt: "2026-10-08T09:00:00Z",
      paidAt: null,
    };
    expect(
      newPaymentAttemptUnavailable({ ...payment, attempts: [attempt] }, now),
    ).toBeTruthy();
    expect(
      newPaymentAttemptUnavailable(
        { ...payment, attempts: [{ ...attempt, status: "FAILED" }] },
        now,
      ),
    ).toBeUndefined();
  });
  it("binds receipts to the amount and every payable target, while allowing status progress", () => {
    expect(paymentIdentity({ ...payment, status: "SUCCEEDED" })).toBe(
      paymentIdentity(payment),
    );
    for (const field of [
      "id",
      "orderId",
      "invoiceId",
      "bookingId",
      "vehicleTransactionId",
    ] as const)
      expect(paymentIdentity({ ...payment, [field]: id(9) })).not.toBe(
        paymentIdentity(payment),
      );
    expect(paymentIdentity({ ...payment, amountKobo: "1" })).not.toBe(
      paymentIdentity(payment),
    );
  });
  it("accepts provider-specific HTTPS checkout destinations", () => {
    expect(validatedCheckout(checkout, "PAYSTACK", now).attemptId).toBe(id(3));
    expect(
      validatedCheckout(
        { ...checkout, authorizationUrl: "https://sandbox.sdk.monnify.com/test" },
        "MONNIFY",
        now,
      ).attemptId,
    ).toBe(id(3));
  });
  it.each([
    "https://sandbox.sdk.monnify.com/test",
    "http://checkout.paystack.com/test",
    "https://checkout.paystack.com.evil.test/",
    "https://user:secret@checkout.paystack.com/",
    "https://checkout.paystack.com:8443/",
    "javascript:alert(1)",
  ])("rejects unsafe or mismatched checkout URL %s", (authorizationUrl) => {
    expect(() =>
      validatedCheckout({ ...checkout, authorizationUrl }, "PAYSTACK", now),
    ).toThrow();
  });
  it.each(["", "invalid", "2026-10-08T10:00:00Z"])(
    "rejects malformed or expired authorization %s",
    (authorizationExpiresAt) => {
      expect(() =>
        validatedCheckout({ ...checkout, authorizationExpiresAt }, "PAYSTACK", now),
      ).toThrow();
    },
  );
});

it("blocks a new checkout after a reversal report even if a stale status is payable", () => {
  expect(
    newPaymentAttemptUnavailable({ ...payment, reversalReported: true }, now),
  ).toContain("reversal");
});
