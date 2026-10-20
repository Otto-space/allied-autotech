// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import {
  clearReservationPolicyPending,
  markReservationPolicyPending,
  readReservationPolicyPending,
  redactReservationPolicyChanges,
} from "@/lib/admin/work-reservation-policy-pending";
const owner = "d1000000-0000-4000-8000-000000000302",
  marker = {
    expectedVersion: 4,
    fingerprint: "a".repeat(64),
  };
describe("reservation policy recovery storage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    setDraftIdentity(`${owner}:SUPER_ADMIN`);
  });
  it("stores minimal actor-bound metadata, blocks replacement and requires a matching token", () => {
    const saved = markReservationPolicyPending(owner, "SUPER_ADMIN", marker);
    expect(readReservationPolicyPending(owner, "SUPER_ADMIN")).toEqual(saved);
    expect(() => markReservationPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    const raw = sessionStorage.getItem(`aat:reservation-policy:v1:${owner}:SUPER_ADMIN`)!;
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual([
      "expectedVersion",
      "fingerprint",
      "token",
    ]);
    expect(() => clearReservationPolicyPending(owner, "SUPER_ADMIN", owner)).toThrow();
    clearReservationPolicyPending(owner, "SUPER_ADMIN", saved.token);
    expect(readReservationPolicyPending(owner, "SUPER_ADMIN")).toBeUndefined();
  });
  it("redacts references and fails closed on unavailable storage or account change", () => {
    markReservationPolicyPending(owner, "SUPER_ADMIN", marker);
    redactReservationPolicyChanges();
    expect(readReservationPolicyPending(owner, "SUPER_ADMIN")).toBe("unknown");
    expect(sessionStorage.getItem(`aat:reservation-policy:v1:${owner}:SUPER_ADMIN`)).toBe(
      "pending",
    );
    clearReservationPolicyPending(owner, "SUPER_ADMIN");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(() => markReservationPolicyPending(owner, "SUPER_ADMIN", marker)).toThrow();
    setDraftIdentity("another:SUPER_ADMIN");
    expect(() => clearReservationPolicyPending(owner, "SUPER_ADMIN")).toThrow();
  });
});
