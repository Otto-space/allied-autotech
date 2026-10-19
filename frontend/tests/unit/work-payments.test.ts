// @vitest-environment jsdom
import { webcrypto } from "node:crypto";
import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { paymentRow, decidePayment, bookingId as id } from "../fixtures/work-payments";
import {
  paymentQuery,
  paymentPageParams,
  parseWorkPayment,
  parseWorkPayments,
  validateManualPayment,
  validatePaymentRefund,
  parsePaymentRefund,
  type PaymentChange,
} from "@/lib/admin/work-payments";
import {
  paymentFingerprint,
  markPaymentPending,
  readPaymentPending,
  clearPaymentPending,
  redactPaymentChanges,
  forgetPaymentDraft,
} from "@/lib/admin/work-payment-pending";
import { draftKey, setDraftIdentity } from "@/lib/forms/drafts";
const owner = id(302),
  role = "ADMIN";
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  setDraftIdentity(null);
  sessionStorage.clear();
});
it("keeps supported URL scope/history while rejecting duplicate, invalid and unsupported filters", () => {
  const input = new URLSearchParams({
      status: "SUCCEEDED",
      provider: "PAYSTACK",
      customerId: id(7),
      selected: id(8),
      attempt: id(9),
    }),
    q = paymentQuery(input);
  expect(q.invalid).toBe(false);
  expect(q.path).toContain("customerId=");
  expect(q.path).not.toContain("selected");
  expect(q.path).not.toContain("attempt=");
  const next = paymentPageParams(input, id(10));
  expect(next.get("_trail")).toBe("start");
  expect(paymentPageParams(next, undefined, true).has("cursor")).toBe(false);
  for (const s of [
    "status=ADMIN",
    "status=SUCCEEDED&status=EXPIRED",
    "q=private",
    "customerId=bad",
    "attempt=" + id(9),
    "cursor=" + id(10) + "&_trail=start," + id(10),
  ])
    expect(paymentQuery(new URLSearchParams(s)).path).toBeNull();
});
it("validates complete financial records, source relationships and staff-only projections", () => {
  const a = paymentRow();
  expect(parseWorkPayment(a).amountKobo).toBe("18500000");
  const invoice = paymentRow(1, true);
  expect(parseWorkPayment(invoice).invoiceId).toBeTruthy();
  const booking = { ...invoice, purpose: "BOOKING_DEPOSIT", invoiceId: null };
  expect(parseWorkPayment(booking).bookingId).toBeTruthy();
  const vehicle = {
    ...invoice,
    purpose: "VEHICLE_FULL_PAYMENT",
    invoiceId: null,
    bookingId: null,
    vehicleTransactionId: id(99),
  };
  expect(parseWorkPayment(vehicle).vehicleTransactionId).toBe(id(99));
  for (const bad of [
    { ...a, orderId: null },
    { ...a, createdAt: "not a date" },
    { ...a, amountKobo: "0" },
    { ...a, customerId: id(8) },
    { ...a, attempts: [...a.attempts, ...a.attempts] },
    {
      ...a,
      attempts: [
        {
          ...a.attempts[0],
          manualReview: { ...a.attempts[0].manualReview, submittedByUserId: id(8) },
        },
      ],
    },
  ])
    expect(() => parseWorkPayment(bad)).toThrow();
});
it("checks unique newest-first pages, exact cursor and any-attempt provider matching", () => {
  const first = paymentRow(),
    second = paymentRow(1, true);
  expect(
    parseWorkPayments(
      { items: [first, second], nextCursor: second.id },
      new URLSearchParams(),
    ).items,
  ).toHaveLength(2);
  for (const bad of [
    { items: [first, first] },
    { items: [second, first] },
    { items: [first], nextCursor: id(99) },
  ])
    expect(() => parseWorkPayments(bad, new URLSearchParams())).toThrow();
  expect(() =>
    parseWorkPayments({ items: [first] }, new URLSearchParams({ status: "SUCCEEDED" })),
  ).toThrow();
  expect(() =>
    parseWorkPayments({ items: [first] }, new URLSearchParams({ provider: "PAYSTACK" })),
  ).toThrow();
  first.attempts.unshift({ ...second.attempts[0], attemptNumber: 2, status: "FAILED" });
  expect(
    parseWorkPayments({ items: [first] }, new URLSearchParams({ provider: "PAYSTACK" }))
      .items[0].attempts,
  ).toHaveLength(2);
});
it("requires exact received manual scope, note, decision and verified settlement facts", () => {
  const payment = paymentRow(),
    change: Extract<PaymentChange, { operation: "manual" }> = {
      payment,
      attemptId: payment.attempts[0].id,
      operation: "manual",
      body: { decision: "APPROVED", reviewerNote: "Exact independent evidence check" },
    },
    saved = decidePayment(structuredClone(payment), "APPROVED", change.body.reviewerNote);
  expect(validateManualPayment(saved, change).status).toBe("SUCCEEDED");
  for (const bad of [
    { ...saved, orderId: id(9) },
    { ...saved, id: id(9) },
    { ...saved, amountKobo: "1" },
    { ...saved, attempts: [{ ...saved.attempts[0], verifiedAt: null }] },
    {
      ...saved,
      attempts: [
        {
          ...saved.attempts[0],
          manualReview: { ...saved.attempts[0].manualReview, reviewerNote: "Other note" },
        },
      ],
    },
  ])
    expect(() => validateManualPayment(bad, change)).toThrow();
  const rejected = {
    ...change,
    body: { decision: "REJECTED" as const, reviewerNote: "Exact rejection" },
  };
  expect(
    validateManualPayment(
      decidePayment(structuredClone(payment), "REJECTED", "Exact rejection"),
      rejected,
    ).attempts[0].status,
  ).toBe("FAILED");
});
function refund() {
  return {
    id: id(1),
    refundNumber: "REF-QA",
    paymentAttemptId: id(184001),
    requestedByUserId: owner,
    approvedByUserId: null,
    amountKobo: "12345",
    currency: "NGN",
    status: "REQUESTED",
    reason: "Exact refund body",
    providerStatus: null,
    failureCode: null,
    requestedAt: "2026-10-18T10:00:37.123Z",
    approvedAt: null,
    processedAt: null,
    failedAt: null,
    updatedAt: "2026-10-18T10:00:37.123Z",
  };
}
it("binds refund responses to exact actor, attempt, amount, reason and replay semantics", () => {
  const payment = paymentRow(1, true),
    change: Extract<PaymentChange, { operation: "refund" }> = {
      payment,
      attemptId: payment.attempts[0].id,
      operation: "refund",
      requestKey: id(20),
      body: {
        paymentAttemptId: payment.attempts[0].id,
        amountKobo: "12345",
        reason: "Exact refund body",
      },
    },
    r = refund();
  expect(validatePaymentRefund({ refund: r, replayed: false }, change, owner).id).toBe(
    r.id,
  );
  for (const altered of [
    { ...r, paymentAttemptId: id(9) },
    { ...r, requestedByUserId: id(9) },
    { ...r, amountKobo: "1" },
    { ...r, reason: "Different body" },
    { ...r, status: "SUCCEEDED" },
  ])
    expect(() =>
      validatePaymentRefund({ refund: altered, replayed: false }, change, owner),
    ).toThrow();
  expect(
    validatePaymentRefund(
      { refund: { ...r, status: "PROCESSING" }, replayed: true },
      change,
      owner,
    ).status,
  ).toBe("PROCESSING");
  expect(() => parsePaymentRefund({ ...r, idempotencyKeyHash: "private" })).toThrow();
});
it("keeps minimal body fingerprints and actor-scoped original references across redaction", async () => {
  const body = {
      paymentAttemptId: id(2),
      amountKobo: "12345",
      reason: "Private original reason",
    },
    fingerprint = await paymentFingerprint(body),
    value = {
      operation: "refund" as const,
      paymentId: id(1),
      attemptId: id(2),
      fingerprint,
      requestKey: id(3),
    },
    marker = markPaymentPending(owner, role, value);
  expect(readPaymentPending(owner, role)).toEqual(marker);
  expect(readPaymentPending(id(99), role)).toBeUndefined();
  expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain(body.reason);
  expect(await paymentFingerprint({ ...body, reason: "Changed reason" })).not.toBe(
    fingerprint,
  );
  expect(() => clearPaymentPending(owner, role, id(9))).toThrow();
  redactPaymentChanges();
  expect(readPaymentPending(owner, role)).toBe("unknown");
  clearPaymentPending(owner, role);
  expect(readPaymentPending(owner, role)).toBeUndefined();
});
it("clears only the affected operation draft and stops a write when pending storage is blocked", () => {
  const key = (op: string, n: number) =>
    draftKey(
      `${owner}:${role}`,
      "/admin/payments",
      JSON.stringify([`staff-payment-${op}:1`, id(n)]),
    );
  for (const [op, n] of [
    ["manual", 1],
    ["refund", 1],
    ["manual", 2],
  ] as const)
    sessionStorage.setItem(key(op, n), "private draft");
  forgetPaymentDraft(owner, role, "manual", id(1));
  expect(sessionStorage.getItem(key("manual", 1))).toBeNull();
  expect(sessionStorage.getItem(key("refund", 1))).toBe("private draft");
  expect(sessionStorage.getItem(key("manual", 2))).toBe("private draft");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw Error("Blocked");
  });
  expect(() =>
    markPaymentPending(owner, role, {
      operation: "manual",
      paymentId: id(1),
      attemptId: id(2),
      fingerprint: "a".repeat(64),
    }),
  ).toThrow();
});
