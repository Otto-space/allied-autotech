import { z } from "zod";
import { paymentSchema } from "@/lib/api/payment-schemas";
import { refundSchema } from "@/lib/api/staff-payment-schemas";
import { inspectionPageParams } from "./work-inspections";
const uuid = z.uuid(),
  date = z.iso.datetime({ offset: true }),
  money = z
    .string()
    .regex(/^\d+$/)
    .refine((v) => BigInt(v) > BigInt(0));
const manual = z
  .object({
    status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
    payerName: z.string().nullable(),
    bankReference: z.string().nullable(),
    transferredAt: date.nullable(),
    evidenceSha256: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    submittedAt: date,
    reviewedAt: date.nullable(),
    reviewerNote: z.string().nullable(),
    canReview: z.boolean(),
  })
  .strict();
const attempt = z
  .object({
    id: uuid,
    attemptNumber: z.number().int().positive(),
    provider: z.enum(["MANUAL", "PAYSTACK", "MONNIFY"]),
    method: z
      .enum([
        "CARD",
        "BANK_TRANSFER",
        "USSD",
        "MOBILE_MONEY",
        "QR",
        "POS",
        "CASH",
        "OTHER",
      ])
      .nullable(),
    status: z.enum([
      "INITIALIZED",
      "PENDING",
      "PROCESSING",
      "SUCCESSFUL",
      "FAILED",
      "ABANDONED",
      "CANCELLED",
    ]),
    verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "MISMATCH", "MANUAL_REVIEW"]),
    amountKobo: money,
    currency: z.literal("NGN"),
    initiatedAt: date,
    paidAt: date.nullable(),
    verifiedAt: date.nullable(),
    manualReview: manual.nullable(),
  })
  .strict()
  .refine(
    (v) =>
      (!v.manualReview || v.provider === "MANUAL") &&
      (!v.manualReview || v.manualReview.status === "PENDING"
        ? true
        : !v.manualReview.canReview && !!v.manualReview.reviewedAt),
  );
const schema = paymentSchema
  .extend({
    amountKobo: money,
    paymentNumber: z.string().min(1),
    purpose: z.enum([
      "ORDER_PAYMENT",
      "SERVICE_INVOICE",
      "BOOKING_DEPOSIT",
      "VEHICLE_RESERVATION",
      "VEHICLE_PARTIAL_PAYMENT",
      "VEHICLE_BALANCE_PAYMENT",
      "VEHICLE_FULL_PAYMENT",
    ]),
    createdAt: date,
    updatedAt: date,
    expiresAt: date.nullable(),
    succeededAt: date.nullable(),
    cancelledAt: date.nullable(),
    expiredAt: date.nullable(),
    attempts: z.array(attempt),
  })
  .strict();
export type WorkPayment = z.infer<typeof schema>;
export type WorkAttempt = WorkPayment["attempts"][number];
export const paymentStatusLabels = {
  REQUIRES_PAYMENT: "Awaiting payment",
  PROCESSING: "Processing",
  REQUIRES_REVIEW: "Requires review",
  SUCCEEDED: "Succeeded",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};
export const paymentPurposeLabels = {
  ORDER_PAYMENT: "Order payment",
  SERVICE_INVOICE: "Service invoice",
  BOOKING_DEPOSIT: "Booking deposit",
  VEHICLE_RESERVATION: "Vehicle reservation",
  VEHICLE_PARTIAL_PAYMENT: "Vehicle partial payment",
  VEHICLE_BALANCE_PAYMENT: "Vehicle balance payment",
  VEHICLE_FULL_PAYMENT: "Vehicle full payment",
};
export function parseWorkPayment(value: unknown) {
  const v = schema.parse(value),
    ids = v.attempts.map((a) => a.id),
    numbers = v.attempts.map((a) => a.attemptNumber);
  if (
    new Set(ids).size !== ids.length ||
    new Set(numbers).size !== numbers.length ||
    numbers.some((n, i) => i > 0 && numbers[i - 1] <= n) ||
    (v.purpose === "ORDER_PAYMENT" && !v.orderId) ||
    (v.purpose === "SERVICE_INVOICE" && !v.invoiceId) ||
    (v.purpose === "BOOKING_DEPOSIT" && !v.bookingId) ||
    (v.purpose.startsWith("VEHICLE_") && !v.vehicleTransactionId)
  )
    throw Error("Unconfirmed payment scope");
  return v;
}
export function paymentQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const key of new Set(input.keys()))
    if (
      ![
        "status",
        "provider",
        "customerId",
        "cursor",
        "_trail",
        "selected",
        "attempt",
      ].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  for (const key of [
    "status",
    "provider",
    "customerId",
    "cursor",
    "selected",
    "attempt",
  ]) {
    const v = input.get(key);
    if (v === null) continue;
    const ok =
      key === "status"
        ? Object.hasOwn(paymentStatusLabels, v)
        : key === "provider"
          ? ["PAYSTACK", "MONNIFY", "MANUAL"].includes(v)
          : uuid.safeParse(v).success;
    if (!ok) invalid = true;
    else params.set(key, ["status", "provider"].includes(key) ? v : v.toLowerCase());
  }
  if (params.has("attempt") && !params.has("selected")) invalid = true;
  const trail = input.get("_trail");
  if (trail !== null) {
    const t = trail.split(",");
    if (
      !params.has("cursor") ||
      t.length > 50 ||
      t[0] !== "start" ||
      t.slice(1).some((v) => !uuid.safeParse(v).success) ||
      new Set(t).size !== t.length ||
      t.includes(params.get("cursor")!)
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  for (const key of ["_trail", "selected", "attempt"]) api.delete(key);
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/payments?${api}` };
}
export const paymentPageParams = inspectionPageParams;
export function parseWorkPayments(value: unknown, params: URLSearchParams) {
  const p = z
      .object({ items: z.array(z.unknown()).max(25), nextCursor: uuid.nullish() })
      .parse(value),
    items = p.items.map(parseWorkPayment);
  if (
    new Set(items.map((v) => v.id)).size !== items.length ||
    (p.nextCursor &&
      (p.nextCursor !== items.at(-1)?.id || p.nextCursor === params.get("cursor"))) ||
    items.some(
      (v, i) =>
        (params.has("status") && v.status !== params.get("status")) ||
        (params.has("provider") &&
          !v.attempts.some((a) => a.provider === params.get("provider"))) ||
        (i > 0 &&
          (Date.parse(items[i - 1].createdAt) < Date.parse(v.createdAt) ||
            (items[i - 1].createdAt === v.createdAt &&
              items[i - 1].id.localeCompare(v.id) <= 0))),
    )
  )
    throw Error("Unconfirmed payment page");
  return { items, nextCursor: p.nextCursor ?? undefined };
}
export const paymentSnapshot = (v: WorkPayment) => JSON.stringify(v);
export type PaymentChange = { payment: WorkPayment; attemptId: string } & (
  | {
      operation: "manual";
      body: { decision: "APPROVED" | "REJECTED"; reviewerNote: string };
    }
  | {
      operation: "refund";
      body: { paymentAttemptId: string; amountKobo: string; reason: string };
      requestKey: string;
    }
);
export function paymentAttempt(change: PaymentChange) {
  const a = change.payment.attempts.find((a) => a.id === change.attemptId);
  if (!a) throw Error("Payment attempt changed");
  return a;
}
function immutable(v: WorkPayment) {
  return JSON.stringify([
    v.id,
    v.paymentNumber,
    v.purpose,
    v.amountKobo,
    v.currency,
    v.createdAt,
    v.expiresAt,
    v.orderId,
    v.invoiceId,
    v.bookingId,
    v.vehicleTransactionId,
  ]);
}
function originalAttempt(a: WorkAttempt) {
  return JSON.stringify([
    a.id,
    a.attemptNumber,
    a.provider,
    a.method,
    a.amountKobo,
    a.currency,
    a.initiatedAt,
    a.manualReview?.payerName,
    a.manualReview?.bankReference,
    a.manualReview?.transferredAt,
    a.manualReview?.submittedAt,
    a.manualReview?.evidenceSha256,
  ]);
}
export function validateManualPayment(
  value: unknown,
  change: Extract<PaymentChange, { operation: "manual" }>,
) {
  const saved = parseWorkPayment(value),
    before = paymentAttempt(change),
    a = saved.attempts.find((a) => a.id === change.attemptId),
    review = a?.manualReview;
  if (
    immutable(saved) !== immutable(change.payment) ||
    saved.attempts.length !== change.payment.attempts.length ||
    !a ||
    originalAttempt(a) !== originalAttempt(before) ||
    !review ||
    review.status !== change.body.decision ||
    review.reviewerNote !== change.body.reviewerNote ||
    review.canReview ||
    !review.reviewedAt ||
    Date.parse(review.reviewedAt) < Date.parse(review.submittedAt) ||
    (change.body.decision === "APPROVED"
      ? a.status !== "SUCCESSFUL" ||
        a.verificationStatus !== "VERIFIED" ||
        !a.paidAt ||
        !a.verifiedAt
      : a.status !== "FAILED") ||
    saved.attempts.some(
      (x) =>
        x.id !== a.id &&
        JSON.stringify(x) !==
          JSON.stringify(change.payment.attempts.find((y) => y.id === x.id)),
    )
  )
    throw Error("Unconfirmed manual decision");
  return saved;
}
export function parsePaymentRefund(value: unknown) {
  const raw = z.record(z.string(), z.unknown()).parse(value);
  for (const key of [
    "idempotencyKeyHash",
    "beneficiaryEncrypted",
    "evidenceObjectKey",
    "reconciliationToken",
    "reconciliationLeaseUntil",
  ])
    if (key in raw) throw Error("Private refund projection");
  return refundSchema
    .extend({
      requestedAt: date,
      updatedAt: date,
      approvedAt: date.nullable(),
      processedAt: date.nullable(),
      failedAt: date.nullable(),
      amountKobo: money,
    })
    .parse(raw);
}
export type PaymentRefund = ReturnType<typeof parsePaymentRefund>;
export function validatePaymentRefund(
  value: unknown,
  change: Extract<PaymentChange, { operation: "refund" }>,
  owner: string,
) {
  const data = z.object({ refund: z.unknown(), replayed: z.boolean() }).parse(value),
    r = parsePaymentRefund(data.refund);
  if (
    r.paymentAttemptId !== change.attemptId ||
    r.paymentAttemptId !== change.body.paymentAttemptId ||
    r.requestedByUserId !== owner ||
    r.amountKobo !== change.body.amountKobo ||
    r.reason !== change.body.reason ||
    (!data.replayed && r.status !== "REQUESTED")
  )
    throw Error("Unconfirmed refund request");
  return r;
}
