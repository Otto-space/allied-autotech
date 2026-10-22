import type { Page } from "@playwright/test";
import type { WorkPayment, PaymentRefund } from "@/lib/admin/work-payments";
import { workBookingsFixture, bookingId } from "./work-bookings";
export { bookingId };
export function paymentRow(n = 0, captured = false): WorkPayment {
  const created = new Date(
    Date.parse("2026-10-18T08:00:00.123Z") - n * 1000,
  ).toISOString();
  return {
    id: bookingId(180000 + n),
    paymentNumber: `PAY-2026-${String(1428 - n).padStart(6, "0")}`,
    amountKobo: captured ? "7500000" : "18500000",
    currency: "NGN",
    purpose: captured ? "SERVICE_INVOICE" : "ORDER_PAYMENT",
    status: captured ? "SUCCEEDED" : "REQUIRES_REVIEW",
    orderId: captured ? null : bookingId(181000 + n),
    invoiceId: captured ? bookingId(182000 + n) : null,
    bookingId: captured ? bookingId(183000 + n) : null,
    vehicleTransactionId: null,
    createdAt: created,
    updatedAt: "2026-10-18T09:00:37.123Z",
    expiresAt: captured ? null : "2026-10-20T11:00:00.123Z",
    succeededAt: captured ? "2026-10-18T08:20:00.123Z" : null,
    cancelledAt: null,
    expiredAt: null,
    attempts: [
      {
        id: bookingId(184000 + n),
        attemptNumber: 1,
        provider: captured ? "PAYSTACK" : "MANUAL",
        method: captured ? "CARD" : "BANK_TRANSFER",
        amountKobo: captured ? "7500000" : "18500000",
        currency: "NGN",
        status: captured ? "SUCCESSFUL" : "PENDING",
        verificationStatus: captured ? "VERIFIED" : "UNVERIFIED",
        initiatedAt: created,
        paidAt: captured ? "2026-10-18T08:20:00.123Z" : null,
        verifiedAt: captured ? "2026-10-18T08:20:01.123Z" : null,
        manualReview: captured
          ? null
          : {
              status: "PENDING",
              payerName: "Amina Okafor",
              bankReference: "TRF-14828",
              transferredAt: "2026-10-18T08:10:00.123Z",
              submittedAt: "2026-10-18T08:15:00.123Z",
              reviewedAt: null,
              reviewerNote: null,
              canReview: true,
              evidenceSha256: null,
            },
      },
    ],
  };
}
export function decidePayment(
  row: WorkPayment,
  decision: "APPROVED" | "REJECTED",
  note: string,
) {
  const a = row.attempts.find((a) => a.manualReview?.status === "PENDING")!;
  row.updatedAt = "2026-10-18T10:00:37.123Z";
  a.manualReview = {
    ...a.manualReview!,
    status: decision,
    reviewerNote: note,
    reviewedAt: row.updatedAt,
    canReview: false,
  };
  if (decision === "APPROVED") {
    row.status = "SUCCEEDED";
    row.succeededAt = row.updatedAt;
    a.status = "SUCCESSFUL";
    a.verificationStatus = "VERIFIED";
    a.paidAt = a.manualReview.transferredAt;
    a.verifiedAt = row.updatedAt;
  } else {
    row.status = "REQUIRES_PAYMENT";
    a.status = "FAILED";
  }
  return row;
}
export async function workPaymentFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role),
    payments = {
      records: [paymentRow(), paymentRow(1, true)],
      mode: "normal",
      directMode: "normal",
      profileMode: "normal",
      writeMode: "normal",
      lookupMode: "normal",
      evidenceMode: "normal",
      evidenceReads: [] as URL[],
      reads: [] as URL[],
      directReads: [] as URL[],
      lookupReads: [] as URL[],
      writes: [] as { path: string; body: Record<string, unknown>; key?: string }[],
      profileReads: 0,
      refunds: new Map<string, PaymentRefund>(),
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
      json: {
        success: true,
        data,
        message: "Synthetic payments",
        meta: { requestId: "work-payments" },
      },
    }),
    fail = (status: number) => ({
      status,
      json: {
        success: false,
        error: {
          code:
            status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : status === 409
                  ? "CONFLICT"
                  : status === 429
                    ? "RATE_LIMITED"
                    : "DATABASE_UNAVAILABLE",
        },
      },
    });
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill(ok({ csrfToken: "payment-csrf-".repeat(4) })),
  );
  await page.route("**/api/v1/staff/profile", async (r) => {
    payments.profileReads++;
    if (payments.profileMode === "hold")
      await new Promise<void>((resolve) => {
        payments.held = resolve;
      });
    if (["error", "denied"].includes(payments.profileMode))
      return r.fulfill(fail(payments.profileMode === "error" ? 503 : 403));
    return r.fulfill(
      ok({
        id: bookingId(payments.profileMode === "mismatch" ? 999 : 302),
        email: "workshop@example.test",
        role,
        status: payments.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: bookingId(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: bookingId(101),
        },
      }),
    );
  });
  await page.route("**/api/v1/staff/payments**", async (r) => {
    const req = r.request(),
      u = new URL(req.url()),
      path = u.pathname.replace("/api/v1/staff/payments", ""),
      key = req.headers()["idempotency-key"];
    if (req.method() === "GET") {
      if (path === "/refunds/original-request") {
        payments.lookupReads.push(u);
        if (["error", "denied"].includes(payments.lookupMode))
          return r.fulfill(fail(payments.lookupMode === "denied" ? 403 : 503));
        const found = payments.refunds.get(key ?? ""),
          value = found ? structuredClone(found) : null;
        if (value && payments.lookupMode === "wrong-reason")
          value.reason = "Other original body";
        if (value && payments.lookupMode === "wrong-actor")
          value.requestedByUserId = bookingId(999);
        return r.fulfill(ok({ found: !!value, refund: value }));
      }
      const direct = path !== "",
        mode = direct ? payments.directMode : payments.mode;
      (direct ? payments.directReads : payments.reads).push(u);
      if (["error", "denied", "missing"].includes(mode))
        return r.fulfill(fail(mode === "error" ? 503 : mode === "denied" ? 403 : 404));
      if (direct) {
        const row = payments.records.find((p) => p.id === path.slice(1));
        if (!row) return r.fulfill(fail(404));
        return r.fulfill(
          ok(
            mode === "malformed"
              ? { id: row.id }
              : mode === "mismatch"
                ? { ...row, id: bookingId(999) }
                : row,
          ),
        );
      }
      const rows =
        mode === "empty"
          ? []
          : payments.records.filter(
              (p) =>
                (!u.searchParams.has("status") ||
                  p.status === u.searchParams.get("status")) &&
                (!u.searchParams.has("provider") ||
                  p.attempts.some((a) => a.provider === u.searchParams.get("provider"))),
            );
      const cursor = u.searchParams.get("cursor"),
        start = cursor ? rows.findIndex((p) => p.id === cursor) + 1 : 0,
        part = rows.slice(start, start + 25);
      if (mode === "duplicate" && part.length > 1) part[1] = part[0];
      return r.fulfill(
        ok(
          mode === "malformed"
            ? { items: [{ id: bookingId(999) }] }
            : {
                items: part,
                ...(rows.length > start + 25 ? { nextCursor: part.at(-1)!.id } : {}),
              },
        ),
      );
    }
    const body = req.postDataJSON();
    if (path.endsWith("/evidence-access")) {
      payments.evidenceReads.push(u);
      if (payments.evidenceMode === "denied") return r.fulfill(fail(403));
      return r.fulfill(
        ok({
          url: "https://storage.invalid/evidence/payment?signature=isolated",
          expiresInSeconds: 60,
        }),
      );
    }
    payments.writes.push({ path, body, key });
    if (payments.writeMode === "hold")
      await new Promise<void>((resolve) => {
        payments.held = resolve;
      });
    if (["rejected", "denied", "rate"].includes(payments.writeMode))
      return r.fulfill(
        fail(
          payments.writeMode === "rejected"
            ? 409
            : payments.writeMode === "denied"
              ? 403
              : 429,
        ),
      );
    let data: unknown;
    if (path.endsWith("/review")) {
      const row = payments.records.find((p) =>
        p.attempts.some((a) => a.id === path.split("/")[2]),
      )!;
      if (payments.writeMode !== "uncommitted")
        decidePayment(row, body.decision, body.reviewerNote);
      const returned = structuredClone(row);
      if (payments.writeMode === "wrong-note")
        returned.attempts[0].manualReview!.reviewerNote = "Other saved note";
      if (payments.writeMode === "wrong-attempt")
        returned.attempts[0].id = bookingId(999);
      if (payments.writeMode === "wrong-source") returned.orderId = bookingId(999);
      data = returned;
    } else if (path === "/refunds") {
      const existing = payments.refunds.get(key!),
        refund = existing ?? {
          id: bookingId(185000 + payments.refunds.size),
          refundNumber: `REF-QA-${payments.refunds.size + 1}`,
          paymentAttemptId: body.paymentAttemptId,
          requestedByUserId: bookingId(302),
          approvedByUserId: null,
          amountKobo: body.amountKobo,
          currency: "NGN" as const,
          status: "REQUESTED" as const,
          reason: body.reason,
          providerStatus: null,
          failureCode: null,
          requestedAt: "2026-10-18T10:00:37.123Z",
          approvedAt: null,
          processedAt: null,
          failedAt: null,
          updatedAt: "2026-10-18T10:00:37.123Z",
        };
      if (payments.writeMode !== "uncommitted") payments.refunds.set(key!, refund);
      const copy = structuredClone(refund);
      if (payments.writeMode === "wrong-note") copy.reason = "Different reason";
      if (payments.writeMode === "wrong-attempt") copy.paymentAttemptId = bookingId(999);
      if (payments.writeMode === "wrong-actor") copy.requestedByUserId = bookingId(999);
      if (payments.writeMode === "wrong-amount") copy.amountKobo = "1";
      data = { refund: copy, replayed: !!existing };
    } else return r.fulfill(fail(404));
    if (["lost", "uncommitted"].includes(payments.writeMode)) return r.abort("failed");
    return r.fulfill(
      ok(payments.writeMode === "malformed" ? { id: bookingId(999) } : data),
    );
  });
  return { ...base, payments };
}
