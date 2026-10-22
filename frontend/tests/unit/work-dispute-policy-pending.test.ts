// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearDisputePolicyPending,
  markDisputePolicyPending,
  readDisputePolicyPending,
  redactDisputePolicyChanges,
} from "@/lib/admin/work-dispute-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("dispute policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markDisputePolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readDisputePolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markDisputePolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:dispute-policy:v1:${owner}:SUPER_ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearDisputePolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearDisputePolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readDisputePolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markDisputePolicyPending(owner, "SUPER_ADMIN", marker);
    redactDisputePolicyChanges();
    expect(readDisputePolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:dispute-policy:v1:${owner}:SUPER_ADMIN`)).toBe(
      "pending",
    );
    clearDisputePolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markDisputePolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearDisputePolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
