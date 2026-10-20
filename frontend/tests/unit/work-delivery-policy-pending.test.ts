// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearDeliveryPolicyPending,
  markDeliveryPolicyPending,
  readDeliveryPolicyPending,
  redactDeliveryPolicyChanges,
} from "@/lib/admin/work-delivery-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("delivery policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markDeliveryPolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readDeliveryPolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markDeliveryPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:delivery-policy:v1:${owner}:SUPER_ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearDeliveryPolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearDeliveryPolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readDeliveryPolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markDeliveryPolicyPending(owner, "SUPER_ADMIN", marker);
    redactDeliveryPolicyChanges();
    expect(readDeliveryPolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:delivery-policy:v1:${owner}:SUPER_ADMIN`)).toBe(
      "pending",
    );
    clearDeliveryPolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markDeliveryPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearDeliveryPolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
