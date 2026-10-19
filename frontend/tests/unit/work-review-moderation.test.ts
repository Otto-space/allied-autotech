// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  moderationQuery,
  moderationPageParams,
  parseModerationRecord,
  parseModerationPage,
  validateModerationReceipt,
  markModerationPending,
  readModerationPending,
  clearModerationPending,
  redactModerationChanges,
  forgetModerationDraft,
  type ModerationChange,
} from "@/lib/admin/work-review-moderation";
import { moderationRow, bookingId as id } from "../fixtures/work-review-moderation";
import { reviewTargets } from "@/lib/api/review-schemas";
import { setDraftIdentity, draftKey } from "@/lib/forms/drafts";
const owner = id(302),
  role = "ADMIN";
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  setDraftIdentity(null);
  sessionStorage.clear();
});
describe("workshop moderation", () => {
  it("keeps exact supported filters, selection and cursor trails without forwarding UI state", () => {
    const p = new URLSearchParams({
        status: "REJECTED",
        targetType: "BUSINESS",
        reviewId: id(110000),
        selected: id(110000),
      }),
      q = moderationQuery(moderationPageParams(p, id(110001)));
    expect(q.invalid).toBe(false);
    expect(q.path).not.toContain("selected");
    expect(q.path).not.toContain("_trail");
    expect(moderationPageParams(q.params, undefined, true).has("cursor")).toBe(false);
    for (const s of [
      "status=bad",
      "cursor=bad",
      "search=feedback",
      "_trail=start",
      "targetType=BUSINESS&targetType=ORDER",
    ])
      expect(moderationQuery(new URLSearchParams(s)).invalid).toBe(true);
  });
  it("retains complete sources for all five targets and rejects contradictory identities", () => {
    for (const target of reviewTargets) {
      const row = moderationRow(0, target);
      expect(parseModerationRecord(row, row.id).targetType).toBe(target);
      expect(() => parseModerationRecord(row, id(9))).toThrow();
    }
    expect(() =>
      parseModerationRecord({ ...moderationRow(), productId: id(1) }),
    ).toThrow();
    const product = moderationRow(0, "PRODUCT");
    expect(() =>
      parseModerationRecord({ ...product, product: { ...product.product, id: id(9) } }),
    ).toThrow();
  });
  it("rejects duplicate, wrongly ordered and filter-mismatched queue pages", () => {
    const a = moderationRow(),
      b = moderationRow(1);
    expect(
      parseModerationPage({ items: [a, b] }, new URLSearchParams()).items,
    ).toHaveLength(2);
    for (const items of [[a, a], [b, a], [{ ...a, status: "APPROVED" }]])
      expect(() => parseModerationPage({ items }, new URLSearchParams())).toThrow();
    expect(() =>
      parseModerationPage({ items: [a], nextCursor: id(9) }, new URLSearchParams()),
    ).toThrow();
  });
  it("validates immutable feedback/source, exact version, decision and nullable note receipts", () => {
    const review = moderationRow(0, "PRODUCT"),
      change: ModerationChange = {
        review,
        body: { expectedVersion: 0, decision: "APPROVED" },
      },
      saved = {
        ...review,
        status: "APPROVED",
        version: 1,
        moderatedAt: "2026-10-18T10:00:37.123Z",
        moderationNote: null,
      };
    expect(validateModerationReceipt({ data: saved }, change).moderationNote).toBeNull();
    for (const bad of [
      { ...saved, id: id(9) },
      { ...saved, comment: "Other feedback" },
      { ...saved, version: 2 },
      { ...saved, moderationNote: "Unreviewed old note" },
      { ...saved, product: { ...saved.product, id: id(9) } },
      { ...saved, moderatedAt: null },
    ])
      expect(() => validateModerationReceipt({ data: bad }, change)).toThrow();
    const rejection: ModerationChange = {
      review,
      body: {
        expectedVersion: 0,
        decision: "REJECTED",
        note: "Exact full customer response",
      },
    };
    expect(
      validateModerationReceipt(
        { data: { ...saved, status: "REJECTED", moderationNote: rejection.body.note } },
        rejection,
      ).status,
    ).toBe("REJECTED");
  });
  it("keeps minimal actor-bound pending data and redacted locks without private feedback", () => {
    const p = markModerationPending(owner, role, {
      review: moderationRow(),
      body: {
        expectedVersion: 0,
        decision: "REJECTED",
        note: "Private full note never in marker",
      },
    });
    expect(readModerationPending(owner, role)).toEqual(p);
    expect(readModerationPending(id(9), role)).toBeUndefined();
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain("Private");
    expect(() => clearModerationPending(owner, role, id(9))).toThrow();
    redactModerationChanges();
    expect(readModerationPending(owner, role)).toBe("unknown");
    clearModerationPending(owner, role);
    expect(readModerationPending(owner, role)).toBeUndefined();
  });
  it("clears only the affected review draft and prevents untracked storage failures", () => {
    const key = (n: number) =>
      draftKey(
        `${owner}:${role}`,
        "/admin/reviews",
        JSON.stringify(["review-moderation-form:1", id(n)]),
      );
    sessionStorage.setItem(key(1), "draft1");
    sessionStorage.setItem(key(2), "draft2");
    forgetModerationDraft(owner, role, id(1));
    expect(sessionStorage.getItem(key(1))).toBeNull();
    expect(sessionStorage.getItem(key(2))).toBe("draft2");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Blocked");
    });
    expect(() =>
      markModerationPending(owner, role, {
        review: moderationRow(),
        body: { expectedVersion: 0, decision: "APPROVED" },
      }),
    ).toThrow();
  });
});
