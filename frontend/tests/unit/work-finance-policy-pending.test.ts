// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearFinancePolicyPending,
  markFinancePolicyPending,
  readFinancePolicyPending,
  redactFinancePolicyChanges,
} from "@/lib/admin/work-finance-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("finance policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markFinancePolicyPending(owner, "ADMIN", marker);
    expect(readFinancePolicyPending(owner, "ADMIN")).toEqual(saved);
    expect(() => markFinancePolicyPending(owner, "ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:finance-policy:v1:${owner}:ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearFinancePolicyPending(owner, "ADMIN", owner)).toThrow();
    clearFinancePolicyPending(owner, "ADMIN", saved.token);
    expect(readFinancePolicyPending(owner, "ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markFinancePolicyPending(owner, "ADMIN", marker);
    redactFinancePolicyChanges();
    expect(readFinancePolicyPending(owner, "ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:finance-policy:v1:${owner}:ADMIN`)).toBe(
      "pending",
    );
    clearFinancePolicyPending(owner, "ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markFinancePolicyPending(owner, "ADMIN", marker)).toThrow();
    setDraftIdentity("another:ADMIN");
    expect(() => clearFinancePolicyPending(owner, "ADMIN")).toThrow();
  });
});
