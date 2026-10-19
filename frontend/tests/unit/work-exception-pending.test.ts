// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearExceptionPending,
  markExceptionPending,
  readExceptionPending,
  redactExceptionChanges,
} from "@/lib/admin/work-exception-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    id: "d1000000-0000-4000-8000-000000210000",
    expectedStatus: "OPEN" as const,
    expectedUpdatedAt: "2026-10-18T09:00:37.123Z",
    fingerprint: "a".repeat(64),
  };
describe("exception recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markExceptionPending(owner, "ADMIN", marker);
    expect(readExceptionPending(owner, "ADMIN")).toEqual(saved);
    expect(() => markExceptionPending(owner, "ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:exception-change:v1:${owner}:ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedStatus",
      "expectedUpdatedAt",
      "fingerprint",
      "id",
      "token",
    ]);
    expect(() => clearExceptionPending(owner, "ADMIN", owner)).toThrow();
    clearExceptionPending(owner, "ADMIN", saved.token);
    expect(readExceptionPending(owner, "ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markExceptionPending(owner, "ADMIN", marker);
    redactExceptionChanges();
    expect(readExceptionPending(owner, "ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:exception-change:v1:${owner}:ADMIN`)).toBe(
      "pending",
    );
    clearExceptionPending(owner, "ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markExceptionPending(owner, "ADMIN", marker)).toThrow();
    setDraftIdentity("another:ADMIN");
    expect(() => clearExceptionPending(owner, "ADMIN")).toThrow();
  });
});
