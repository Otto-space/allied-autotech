// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearRetentionPolicyPending,
  markRetentionPolicyPending,
  readRetentionPolicyPending,
  redactRetentionPolicyChanges,
} from "@/lib/admin/work-retention-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("retention policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markRetentionPolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readRetentionPolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markRetentionPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:retention-policy:v1:${owner}:SUPER_ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearRetentionPolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearRetentionPolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readRetentionPolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markRetentionPolicyPending(owner, "SUPER_ADMIN", marker);
    redactRetentionPolicyChanges();
    expect(readRetentionPolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:retention-policy:v1:${owner}:SUPER_ADMIN`)).toBe(
      "pending",
    );
    clearRetentionPolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markRetentionPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearRetentionPolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
