// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity, draftKey } from "@/lib/forms/drafts";
import {
  markRefundPending,
  readRefundPending,
  clearRefundPending,
  redactRefundChanges,
  purgeRefundBankDrafts,
} from "@/lib/admin/work-refund-pending";
import { id } from "../fixtures/work-refunds";
const owner = id(302),
  marker = {
    refundId: id(200000),
    action: "decision" as const,
    expectedUpdatedAt: "2026-10-18T09:00:37.123Z",
    fingerprint: "a".repeat(64),
  };
describe("private refund recovery", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:ADMIN`);
  });
  it("stores only the actor-bound minimal lock, rejects replacement and clears only its matching receipt", () => {
    const value = markRefundPending(owner, "ADMIN", marker);
    expect(readRefundPending(owner, "ADMIN")).toEqual(value);
    expect(readRefundPending(id(999), "ADMIN")).toBeUndefined();
    expect(() => markRefundPending(owner, "ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:staff-refund-change:v1:${owner}:ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "action",
      "expectedUpdatedAt",
      "fingerprint",
      "refundId",
      "token",
    ]);
    expect(() => clearRefundPending(owner, "ADMIN", id(999))).toThrow();
    clearRefundPending(owner, "ADMIN", value.token);
    expect(readRefundPending(owner, "ADMIN")).toBeUndefined();
  });
  it("redacts references into an unresolved lock and fails closed when storage or identity changes", () => {
    markRefundPending(owner, "ADMIN", marker);
    redactRefundChanges();
    expect(readRefundPending(owner, "ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:staff-refund-change:v1:${owner}:ADMIN`)).toBe(
      "pending",
    );
    clearRefundPending(owner, "ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markRefundPending(owner, "ADMIN", marker)).toThrow();
    setDraftIdentity(`${id(999)}:ADMIN`);
    expect(() => clearRefundPending(owner, "ADMIN")).toThrow();
  });
  it("purges legacy bank/evidence drafts for this account while preserving unrelated drafts without reading their values", () => {
    const bank = draftKey(
        `${owner}:ADMIN`,
        "/admin/refunds",
        JSON.stringify(["refund-transfer-form:1", id(200001)]),
      ),
      scoped = draftKey(
        `${owner}:ADMIN`,
        "/admin/refunds",
        `${id(200002)}:${JSON.stringify(["refund-evidence-check:1", id(200002)])}`,
      ),
      note = draftKey(
        `${owner}:ADMIN`,
        "/admin/refunds",
        JSON.stringify(["refund-decision-form:1", id(200000)]),
      ),
      other = draftKey(
        `${id(999)}:ADMIN`,
        "/admin/refunds",
        JSON.stringify(["refund-transfer-form:1", id(200001)]),
      );
    for (const key of [bank, scoped, note, other, "aat:form-draft:v1:broken"])
      sessionStorage.setItem(key, "Synthetic private draft");
    purgeRefundBankDrafts(owner, "ADMIN");
    expect(sessionStorage.getItem(bank)).toBeNull();
    expect(sessionStorage.getItem(scoped)).toBeNull();
    expect(sessionStorage.getItem(note)).toBeTruthy();
    expect(sessionStorage.getItem(other)).toBeTruthy();
  });
});
