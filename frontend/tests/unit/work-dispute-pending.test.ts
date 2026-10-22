// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearDisputePending,
  markDisputePending,
  readDisputePending,
  redactDisputeChanges,
} from "@/lib/admin/work-dispute-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    id: "d1000000-0000-4000-8000-000000210000",
    action: "assign" as const,
    expectedUpdatedAt: "2026-10-18T09:00:37.123Z",
    fingerprint: "a".repeat(64),
  };
describe("dispute recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markDisputePending(owner, "ADMIN", marker);
    expect(readDisputePending(owner, "ADMIN")).toEqual(saved);
    expect(() => markDisputePending(owner, "ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:dispute-change:v1:${owner}:ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "action",
      "expectedUpdatedAt",
      "fingerprint",
      "id",
      "token",
    ]);
    expect(() => clearDisputePending(owner, "ADMIN", owner)).toThrow();
    clearDisputePending(owner, "ADMIN", saved.token);
    expect(readDisputePending(owner, "ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markDisputePending(owner, "ADMIN", marker);
    redactDisputeChanges();
    expect(readDisputePending(owner, "ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:dispute-change:v1:${owner}:ADMIN`)).toBe(
      "pending",
    );
    clearDisputePending(owner, "ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markDisputePending(owner, "ADMIN", marker)).toThrow();
    setDraftIdentity("another:ADMIN");
    expect(() => clearDisputePending(owner, "ADMIN")).toThrow();
  });
});
