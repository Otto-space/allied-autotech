import { describe, expect, it } from "vitest";
import {
  disputeOverviewPageParams,
  disputeOverviewQuery,
  parseDisputeOverviewPage,
} from "@/lib/admin/work-payment-disputes";
import { disputeOverviewRow, id } from "../fixtures/work-payment-disputes";
describe("dispute overview boundaries", () => {
  it("binds supported URL state and excludes UI disclosure/history from API filters", () => {
    const q = disputeOverviewQuery(
      new URLSearchParams(
        `status=AWAITING_RESPONSE&category=FRAUD&expanded=${id(220000)}`,
      ),
    );
    expect(q.invalid).toBe(false);
    expect(q.path).toBe(
      "/admin/operations/payment-disputes?status=AWAITING_RESPONSE&category=FRAUD&limit=25",
    );
    const next = disputeOverviewPageParams(q.params, id(220025));
    expect(next.get("expanded")).toBe(id(220000));
    expect(next.get("_trail")).toBe("start");
    expect(disputeOverviewPageParams(next, undefined, true).has("cursor")).toBe(false);
    for (const value of [
      "status=BAD",
      "category=BAD",
      "provider=PAYSTACK",
      "status=WON&status=LOST",
      "expanded=bad",
      `cursor=${id(4)}&_trail=start,${id(4)}`,
      "_trail=start",
    ])
      expect(disputeOverviewQuery(new URLSearchParams(value)).invalid).toBe(true);
  });
  it("preserves exact money and nullable observations without inferring a chargeback", () => {
    const large = disputeOverviewRow(3),
      page = parseDisputeOverviewPage({ items: [large] }, new URLSearchParams());
    expect(page.items[0].amountKobo).toBe("9223372036854775807");
    expect(page.items[0].chargebackAmountKobo).toBe("5000000");
    expect(
      parseDisputeOverviewPage({ items: [disputeOverviewRow()] }, new URLSearchParams())
        .items[0].chargebackAmountKobo,
    ).toBeNull();
  });
  it("rejects malformed dates, private fields, duplicate/order/filter/cursor errors", () => {
    const rows = [disputeOverviewRow(), disputeOverviewRow(1)];
    expect(
      parseDisputeOverviewPage({ items: rows }, new URLSearchParams()).items,
    ).toHaveLength(2);
    for (const items of [
      [{ ...rows[0], evidenceObjectKey: "private" }],
      [{ ...rows[0], openedAt: "bad" }],
      [rows[0], rows[0]],
      [...rows].reverse(),
    ])
      expect(() => parseDisputeOverviewPage({ items }, new URLSearchParams())).toThrow();
    expect(() =>
      parseDisputeOverviewPage({ items: rows }, new URLSearchParams("status=WON")),
    ).toThrow();
    expect(() =>
      parseDisputeOverviewPage(
        { items: rows, nextCursor: rows[0].id },
        new URLSearchParams(),
      ),
    ).toThrow();
  });
});
