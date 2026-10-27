// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearComplaintPolicyPending,
  markComplaintPolicyPending,
  readComplaintPolicyPending,
  redactComplaintPolicyChanges,
} from "@/lib/admin/work-complaint-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("complaint policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markComplaintPolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readComplaintPolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markComplaintPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:complaint-policy:v1:${owner}:SUPER_ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearComplaintPolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearComplaintPolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readComplaintPolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markComplaintPolicyPending(owner, "SUPER_ADMIN", marker);
    redactComplaintPolicyChanges();
    expect(readComplaintPolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:complaint-policy:v1:${owner}:SUPER_ADMIN`)).toBe(
      "pending",
    );
    clearComplaintPolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markComplaintPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearComplaintPolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
