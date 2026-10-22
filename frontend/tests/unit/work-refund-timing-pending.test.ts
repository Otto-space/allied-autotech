// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearRefundTimingPolicyPending,
  markRefundTimingPolicyPending,
  readRefundTimingPolicyPending,
  redactRefundTimingPolicyChanges,
} from "@/lib/admin/work-refund-timing-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("refund-timing policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markRefundTimingPolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readRefundTimingPolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markRefundTimingPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(
      `aat:refund-timing-policy:v1:${owner}:SUPER_ADMIN`,
    )!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearRefundTimingPolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearRefundTimingPolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readRefundTimingPolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markRefundTimingPolicyPending(owner, "SUPER_ADMIN", marker);
    redactRefundTimingPolicyChanges();
    expect(readRefundTimingPolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(
      sessionStorage.getItem(`aat:refund-timing-policy:v1:${owner}:SUPER_ADMIN`),
    ).toBe("pending");
    clearRefundTimingPolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markRefundTimingPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearRefundTimingPolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
