import { describe, it, expect } from "vitest";
import {
  handlingQuery,
  handlingPageParams,
  parseCurrentDispute,
  parseHandlingPage,
  validateHandlingReceipt,
} from "@/lib/admin/work-dispute-handling";
import { disputeHandlingRow, id } from "../fixtures/work-dispute-handling";
describe("dispute handling contract boundaries", () => {
  it("keeps URL history separate from API scope and rejects ambiguous queries", () => {
    const q = handlingQuery(new URLSearchParams(`selected=${id(220000)}&openOnly=false`));
    expect(q.invalid).toBe(false);
    expect(q.path).not.toContain("selected");
    const next = handlingPageParams(q.params, id(220025));
    expect(next.get("_trail")).toBe("start");
    expect(handlingPageParams(next, undefined, true).has("cursor")).toBe(false);
    for (const value of [
      "openOnly=bad",
      "openOnly=true&openOnly=false",
      "selected=no",
      "q=unsupported",
      "_trail=start",
    ])
      expect(handlingQuery(new URLSearchParams(value)).invalid).toBe(true);
  });
  it("rejects wrong assignments, leaked fields, wrong filters and repeated cursors", () => {
    const row = disputeHandlingRow(1);
    expect(parseCurrentDispute(row, row.id, id(302), "STAFF").amountKobo).toBe(
      "12500000",
    );
    expect(() => parseCurrentDispute(row, row.id, id(999), "STAFF")).toThrow();
    expect(() =>
      parseCurrentDispute(
        { ...row, evidenceObjectKey: "private" },
        row.id,
        id(302),
        "ADMIN",
      ),
    ).toThrow();
    expect(() =>
      parseHandlingPage(
        { items: [disputeHandlingRow(2)], nextCursor: null },
        new URLSearchParams(),
        id(302),
        "ADMIN",
      ),
    ).toThrow();
    expect(() =>
      parseHandlingPage(
        { items: [row], nextCursor: row.id },
        new URLSearchParams(`cursor=${row.id}`),
        id(302),
        "STAFF",
      ),
    ).toThrow();
  });
  it("validates the whole action receipt and preserves unrelated provider facts", () => {
    const before = disputeHandlingRow(),
      change = {
        action: "acknowledge" as const,
        body: {
          note: "Reviewed original operator evidence",
          expectedUpdatedAt: before.updatedAt,
        },
      };
    const receipt = {
      ...before,
      acknowledgedAt: "2026-10-18T11:00:00Z",
      acknowledgedByUserId: id(302),
      updatedAt: "2026-10-18T11:00:00Z",
    };
    expect(validateHandlingReceipt(receipt, before, change, id(302), "ADMIN")).toEqual(
      receipt,
    );
    for (const patch of [
      { amountKobo: "1" },
      { providerDisputeId: "wrong" },
      { providerStatus: "resolved" },
      { acknowledgedByUserId: id(303) },
    ])
      expect(() =>
        validateHandlingReceipt(
          { ...receipt, ...patch },
          before,
          change,
          id(302),
          "ADMIN",
        ),
      ).toThrow();
  });
});
