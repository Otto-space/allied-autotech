// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { invalidateSession } from "@/lib/api/client";
import {
  readReviewRecovery,
  saveReviewRecovery,
  type ReviewIntent,
} from "@/lib/reviews/review-recovery";

const owner = "a1000000-0000-4000-8000-000000000001",
  other = "a1000000-0000-4000-8000-000000000002";
const slot = `aat:review-write:v1:${owner}`;
const intent = (): ReviewIntent => ({
  owner,
  key: `review-v1.${Date.now()}.b1000000-0000-4000-8000-000000000001`,
  body: {
    targetType: "BUSINESS",
    rating: 5,
    title: " A title ",
    comment: " Original feedback ",
  },
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:CUSTOMER`);
});
afterEach(() => vi.restoreAllMocks());
describe("review original request recovery", () => {
  it("retains the normalized immutable request across reload reads", () => {
    const original = intent();
    saveReviewRecovery(original);
    expect(readReviewRecovery(owner)).toEqual({
      kind: "pending",
      intent: {
        ...original,
        body: { ...original.body, title: "A title", comment: "Original feedback" },
      },
    });
    expect(readReviewRecovery(other)).toBeUndefined();
  });
  it("preserves uncertainty for old markers, damaged data and wrong-account bodies", () => {
    for (const value of ["pending", "{", JSON.stringify({ ...intent(), owner: other })]) {
      sessionStorage.setItem(slot, value);
      expect(readReviewRecovery(owner)).toEqual({ kind: "history" });
    }
  });
  it("does not replay expired or future requests", () => {
    for (const stamp of [Date.now() - 24 * 3600000, Date.now() + 60000]) {
      sessionStorage.setItem(
        slot,
        JSON.stringify({
          ...intent(),
          key: `review-v1.${stamp}.b1000000-0000-4000-8000-000000000001`,
        }),
      );
      expect(readReviewRecovery(owner)).toEqual({ kind: "history" });
    }
  });
  it("denies writes from a different account or role", () => {
    for (const identity of [`${other}:CUSTOMER`, `${owner}:ADMIN`, null]) {
      setDraftIdentity(identity);
      expect(() => saveReviewRecovery(intent())).toThrow();
    }
    expect(sessionStorage.getItem(slot)).toBeNull();
  });
  it("session invalidation redacts review content while retaining an uncertainty marker", () => {
    saveReviewRecovery(intent());
    invalidateSession();
    expect(sessionStorage.getItem(slot)).toBe("pending");
    expect(readReviewRecovery(owner)).toEqual({ kind: "history" });
  });
  it("fails closed when browser storage cannot be read or verified", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    expect(() => saveReviewRecovery(intent())).toThrow();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage denied");
    });
    expect(readReviewRecovery(owner)).toEqual({ kind: "unavailable" });
  });
});
