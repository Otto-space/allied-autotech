import { describe, it, expect } from "vitest";
import {
  availableRefundAction,
  parseCurrentRefund,
  parseRefundPage,
  refundQuery,
  refundPageParams,
  refundSnapshot,
  validateRefundDecision,
} from "@/lib/admin/work-refunds";
import { refundRow, id } from "../fixtures/work-refunds";
const current = () => ({ ...refundRow(), cancelledAt: null, cancellationNote: null });
describe("refund workspace boundaries", () => {
  it("uses supported filters and preserves UI selection/cursor history without forwarding them", () => {
    const selected = id(200000),
      first = refundQuery(
        new URLSearchParams(`status=REQUESTED&refundId=${selected}`),
        true,
      );
    expect(first.invalid).toBe(false);
    expect(first.path).toBe(
      "/admin/operations/payment-refunds?status=REQUESTED&limit=25",
    );
    const next = refundPageParams(first.params, id(200025));
    expect(next.get("refundId")).toBe(selected);
    expect(next.get("_trail")).toBe("start");
    expect(refundQuery(next, false).path).toContain("/staff/refunds?");
    expect(refundPageParams(next, undefined, true).has("cursor")).toBe(false);
    for (const query of [
      "status=UNKNOWN",
      "status=REQUESTED&status=APPROVED",
      "customerId=x",
      "refundId=invalid",
      `_trail=start&cursor=${selected}&_trail=start`,
      `_trail=start,${selected}&cursor=${selected}`,
    ])
      expect(refundQuery(new URLSearchParams(query), true).invalid).toBe(true);
  });
  it("binds current facts to the original reference and retains exact large integer amounts", () => {
    const value = { ...current(), amountKobo: "9223372036854775807" };
    expect(parseCurrentRefund(value, value.id).amountKobo).toBe(value.amountKobo);
    expect(() => parseCurrentRefund(value, id(999))).toThrow();
    expect(() => parseCurrentRefund({ ...value, amountKobo: "0" }, value.id)).toThrow();
    expect(() =>
      parseCurrentRefund({ ...value, evidenceObjectKey: "private" }, value.id),
    ).toThrow();
    expect(refundSnapshot(value)).not.toBe(
      refundSnapshot({ ...value, cancellationNote: "Changed current fact" }),
    );
  });
  it("rejects duplicate, incorrectly ordered, incorrectly filtered and circular cursor pages", () => {
    const rows = [refundRow(), refundRow(1)];
    expect(
      parseRefundPage({ items: rows, nextCursor: rows[1].id }, new URLSearchParams())
        .items,
    ).toHaveLength(2);
    for (const items of [[rows[0], rows[0]], [...rows].reverse()])
      expect(() => parseRefundPage({ items }, new URLSearchParams())).toThrow();
    expect(() =>
      parseRefundPage({ items: rows }, new URLSearchParams("status=REQUESTED")),
    ).toThrow();
    expect(() =>
      parseRefundPage({ items: rows, nextCursor: rows[0].id }, new URLSearchParams()),
    ).toThrow();
    expect(() =>
      parseRefundPage(
        { items: rows, nextCursor: rows[1].id },
        new URLSearchParams(`cursor=${rows[1].id}`),
      ),
    ).toThrow();
  });
  it("requires each live capability and independent operator and never offers bank handling for gateways", () => {
    const actor = id(999),
      grants = ["REFUND_APPROVE", "REFUND_TRANSFER", "REFUND_CHECK"];
    expect(availableRefundAction(refundRow(), actor, grants)).toBe("decision");
    expect(
      availableRefundAction(refundRow(), refundRow().requestedByUserId!, grants),
    ).toBeUndefined();
    expect(availableRefundAction(refundRow(1), actor, grants)).toBe("transfer");
    expect(
      availableRefundAction(refundRow(1), refundRow(1).approvedByUserId!, grants),
    ).toBeUndefined();
    expect(availableRefundAction(refundRow(2), actor, grants)).toBe("check");
    expect(
      availableRefundAction(refundRow(2), refundRow(2).transferredByUserId!, grants),
    ).toBeUndefined();
    expect(
      availableRefundAction(
        { ...refundRow(1), paymentAttempt: { provider: "PAYSTACK" } },
        actor,
        grants,
      ),
    ).toBeUndefined();
    expect(availableRefundAction(refundRow(1), actor, [])).toBeUndefined();
    expect(availableRefundAction(refundRow(3), actor, grants)).toBeUndefined();
  });
  it("accepts exact cancellation/approval receipts and rejects changed body, source, money or actor facts", () => {
    const before = current(),
      actor = id(999),
      note = "Original part was retained",
      now = "2026-10-18T11:00:00.123Z";
    const cancelled = {
      ...before,
      status: "CANCELLED",
      cancelledAt: now,
      updatedAt: now,
      cancellationNote: note,
    };
    expect(
      validateRefundDecision(cancelled, before, { decision: "CANCELLED", note }, actor)
        .cancelledAt,
    ).toBe(now);
    for (const patch of [
      { amountKobo: "1" },
      { paymentAttemptId: id(333) },
      { cancellationNote: "Another note" },
      { cancelledAt: null },
      { status: "REQUESTED" },
    ])
      expect(() =>
        validateRefundDecision(
          { ...cancelled, ...patch },
          before,
          { decision: "CANCELLED", note },
          actor,
        ),
      ).toThrow();
    const approved = {
      ...before,
      status: "NEEDS_ATTENTION",
      approvedAt: now,
      approvedByUserId: actor,
      updatedAt: now,
    };
    expect(
      validateRefundDecision(approved, before, { decision: "APPROVED" }, actor).status,
    ).toBe("NEEDS_ATTENTION");
    expect(() =>
      validateRefundDecision(
        { ...approved, approvedByUserId: id(998) },
        before,
        { decision: "APPROVED" },
        actor,
      ),
    ).toThrow();
    expect(() =>
      validateRefundDecision(
        approved,
        before,
        { decision: "APPROVED" },
        before.requestedByUserId!,
      ),
    ).toThrow();
  });
});
