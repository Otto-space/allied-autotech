import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../lib/api/client", () => ({ apiRequest: vi.fn() }));
import { apiRequest } from "../../lib/api/client";
import {
  blockingOrderPayment,
  orderPaymentSnapshot,
  orderPaymentUnavailable,
  parseOrderPayment,
  readOrderPayments,
  type CustomerOrder,
} from "../../lib/api/order-payment";
import type { PaymentRecord } from "../../lib/api/payment-schemas";
const id = (n: number) => `e9000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const order = {
  id: id(1),
  status: "PENDING",
  totalKobo: "10000",
  version: 1,
  paidAt: null,
  paymentDueAt: "2026-10-08T10:00:00Z",
} as CustomerOrder;
const payment: PaymentRecord = {
  id: id(2),
  paymentNumber: "TEST",
  amountKobo: "10000",
  currency: "NGN",
  status: "REQUIRES_PAYMENT",
  purpose: "ORDER_PAYMENT",
  expiresAt: null,
  orderId: id(1),
  invoiceId: null,
  bookingId: null,
  vehicleTransactionId: null,
  attempts: [],
};
const request = vi.mocked(apiRequest);
beforeEach(() => request.mockReset());
describe("order payment boundaries", () => {
  it("allows pending and confirmed unpaid orders before the deadline", () => {
    const now = Date.parse("2026-10-08T09:59:59Z");
    expect(orderPaymentUnavailable(order, now)).toBeUndefined();
    expect(
      orderPaymentUnavailable({ ...order, status: "CONFIRMED" }, now),
    ).toBeUndefined();
  });
  it.each(["", "tomorrow", "2026-10-08"])(
    "rejects an unverifiable deadline %s",
    (paymentDueAt) => {
      expect(orderPaymentUnavailable({ ...order, paymentDueAt }, 0)).toMatch(
        /could not be verified/,
      );
    },
  );
  it("expires exactly at the boundary; absent deadlines stay server-governed", () => {
    expect(orderPaymentUnavailable(order, Date.parse(order.paymentDueAt!))).toMatch(
      /passed/,
    );
    expect(
      orderPaymentUnavailable({ ...order, paymentDueAt: null }, Date.now()),
    ).toBeUndefined();
  });
  it("does not offer new requests for paid, zero-value or advanced orders", () => {
    expect(orderPaymentUnavailable({ ...order, paidAt: "2026-10-08T09:00:00Z" })).toMatch(
      /already/,
    );
    expect(orderPaymentUnavailable({ ...order, totalKobo: "0" })).toMatch(/amount/);
    for (const status of ["PROCESSING", "READY", "COMPLETED", "CANCELLED"] as const)
      expect(orderPaymentUnavailable({ ...order, status })).toMatch(/not open/);
  });
  it("binds review to amount, version, deadline and paid state", () => {
    for (const change of [
      { totalKobo: "10001" },
      { version: 2 },
      { paymentDueAt: null },
      { paidAt: "2026-10-08T09:00:00Z" },
    ])
      expect(orderPaymentSnapshot({ ...order, ...change })).not.toBe(
        orderPaymentSnapshot(order),
      );
  });
  it("rejects receipts for a different resource, mixed target or zero amount", () => {
    expect(parseOrderPayment(payment, id(1))).toEqual(payment);
    for (const change of [
      { orderId: id(3) },
      { invoiceId: id(4) },
      { purpose: "INVOICE_PAYMENT" },
      { amountKobo: "0" },
    ])
      expect(() => parseOrderPayment({ ...payment, ...change }, id(1))).toThrow();
  });
  it("blocks new creation for succeeded, review and unresolved-attempt states", () => {
    expect(blockingOrderPayment({ ...payment, status: "SUCCEEDED" })).toBe(true);
    expect(blockingOrderPayment({ ...payment, status: "EXPIRED" })).toBe(false);
    const attempt = {
      id: id(9),
      provider: "PAYSTACK" as const,
      status: "PENDING",
      verificationStatus: "PENDING",
      initiatedAt: "2026-10-08T09:00:00Z",
      paidAt: null,
    };
    expect(
      blockingOrderPayment({ ...payment, status: "EXPIRED", attempts: [attempt] }),
    ).toBe(true);
    expect(
      blockingOrderPayment({
        ...payment,
        status: "EXPIRED",
        attempts: [{ ...attempt, status: "FAILED" }],
      }),
    ).toBe(false);
  });
  it("reads beyond the first history page and filters by the owned order", async () => {
    request.mockResolvedValueOnce({
      data: { items: [{ ...payment, orderId: id(8) }], nextCursor: id(5) },
    } as never);
    request.mockResolvedValueOnce({
      data: { items: [{ ...payment, id: id(6) }] },
    } as never);
    expect(await readOrderPayments(id(1), new AbortController().signal)).toEqual([
      { ...payment, id: id(6) },
    ]);
    expect(request).toHaveBeenLastCalledWith(
      expect.stringContaining(`cursor=${id(5)}`),
      expect.any(Object),
    );
  });
  it("rejects repeated cursors and duplicate payment identities", async () => {
    request.mockResolvedValue({ data: { items: [], nextCursor: id(5) } } as never);
    await expect(readOrderPayments(id(1), new AbortController().signal)).rejects.toThrow(
      /cursor/,
    );
    request.mockReset();
    request.mockResolvedValueOnce({
      data: { items: [payment], nextCursor: id(5) },
    } as never);
    request.mockResolvedValueOnce({ data: { items: [payment] } } as never);
    await expect(readOrderPayments(id(1), new AbortController().signal)).rejects.toThrow(
      /changed/,
    );
  });
  it("does not accept an interrupted history check", async () => {
    const controller = new AbortController();
    controller.abort();
    request.mockResolvedValue({ data: { items: [] } } as never);
    await expect(readOrderPayments(id(1), controller.signal)).rejects.toThrow(
      /interrupted/,
    );
  });
});
