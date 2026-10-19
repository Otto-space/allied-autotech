// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  privacyQuery,
  privacyPageParams,
  parsePrivacyWorkPage,
  parsePrivacyHolds,
  privacySnapshot,
  validatePrivacyChange,
  markPrivacyPending,
  readPrivacyPending,
  clearPrivacyPending,
  redactPrivacyChanges,
  forgetPrivacyDrafts,
  type PrivacyChange,
} from "@/lib/admin/work-privacy";
import { privacyRow, bookingId as id } from "../fixtures/work-privacy";
import { privacyRequestSchema, type RetentionHold } from "@/lib/api/privacy-schemas";
import { setDraftIdentity, draftKey } from "@/lib/forms/drafts";
const owner = id(302),
  role = "ADMIN",
  row = () => privacyRequestSchema.parse(privacyRow()),
  hold = (): RetentionHold => ({
    id: id(98000),
    userId: row().userId,
    recordType: "ALL",
    recordId: null,
    reason: "Original protection reason",
    createdAt: "2026-10-18T09:00:00.123Z",
    releasedAt: null,
  });
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  setDraftIdentity(null);
  sessionStorage.clear();
});
describe("workshop privacy review", () => {
  it("preserves supported query and cursor/selection state without forwarding UI fields", () => {
    const p = new URLSearchParams({
        kind: "DELETION",
        status: "REQUESTED",
        userId: row().userId,
        request: row().id,
      }),
      next = privacyPageParams(p, row().id);
    expect(privacyQuery(next).invalid).toBe(false);
    expect(privacyQuery(next).path).not.toContain("request=");
    expect(privacyQuery(next).path).not.toContain("_trail");
    expect(privacyPageParams(next, undefined, true).has("cursor")).toBe(false);
    for (const q of [
      "search=private",
      "status=bad",
      "cursor=x",
      "kind=DELETION&kind=ANONYMIZATION",
      "_trail=start",
    ])
      expect(privacyQuery(new URLSearchParams(q)).invalid).toBe(true);
  });
  it("rejects duplicate, out-of-order and filter-mismatched private request pages", () => {
    const a = privacyRow(),
      b = privacyRow(1);
    expect(
      parsePrivacyWorkPage({ items: [a, b] }, new URLSearchParams()).items,
    ).toHaveLength(2);
    for (const items of [[a, a], [b, a], [b]])
      expect(() =>
        parsePrivacyWorkPage({ items }, new URLSearchParams("kind=DELETION")),
      ).toThrow();
    expect(() =>
      parsePrivacyWorkPage({ items: [a], nextCursor: id(99) }, new URLSearchParams()),
    ).toThrow();
  });
  it("validates scoped unique capped hold history and complete exact review receipts", () => {
    const a = hold();
    expect(parsePrivacyHolds([a], row().userId)).toHaveLength(1);
    expect(() => parsePrivacyHolds([a, a], row().userId)).toThrow();
    expect(() => parsePrivacyHolds([a], id(9))).toThrow();
    const before = row(),
      change: PrivacyChange = {
        kind: "review",
        request: before,
        body: {
          status: "UNDER_REVIEW",
          note: "Exact customer-visible response",
          expectedReviewedAt: null,
        },
      },
      saved = {
        ...before,
        status: "UNDER_REVIEW",
        reviewNote: change.body.note,
        reviewedAt: "2026-10-18T09:00:37.123Z",
      };
    expect(validatePrivacyChange({ data: saved }, change).record?.reviewedAt).toBe(
      saved.reviewedAt,
    );
    for (const bad of [
      { ...saved, userId: id(9) },
      { ...saved, reason: "Different original reason" },
      { ...saved, reviewNote: "Other response" },
      { ...saved, reviewedAt: null },
    ])
      expect(() => validatePrivacyChange({ data: bad }, change)).toThrow();
    expect(privacySnapshot(before)).not.toBe(
      privacySnapshot(privacyRequestSchema.parse(saved)),
    );
  });
  it("requires exact hold creation and audited release scope/body", () => {
    const a = hold(),
      create: PrivacyChange = {
        kind: "hold",
        request: row(),
        body: { userId: a.userId, recordType: a.recordType, reason: a.reason },
      },
      release: PrivacyChange = {
        kind: "release",
        request: row(),
        hold: a,
        body: { reason: "Exact documented release justification" },
      },
      saved = {
        id: a.id,
        userId: a.userId,
        releasedAt: "2026-10-18T10:00:37.123Z",
        releaseReason: release.body.reason,
      };
    expect(validatePrivacyChange({ data: a }, create).hold?.id).toBe(a.id);
    expect(validatePrivacyChange({ data: saved }, release).released?.id).toBe(a.id);
    for (const bad of [
      { ...saved, userId: id(9) },
      { ...saved, releaseReason: "Another reason" },
      { id: a.id },
    ])
      expect(() => validatePrivacyChange({ data: bad }, release)).toThrow();
  });
  it("keeps minimal actor-bound markers and preserves redacted uncertainty", () => {
    const change: PrivacyChange = {
        kind: "review",
        request: row(),
        body: { note: "Private body never in pending marker" },
      },
      p = markPrivacyPending(owner, role, change);
    expect(readPrivacyPending(owner, role)).toEqual(p);
    expect(readPrivacyPending(id(9), role)).toBeUndefined();
    expect(JSON.stringify(Object.entries(sessionStorage))).not.toContain("Private body");
    expect(() => markPrivacyPending(owner, role, change)).toThrow();
    redactPrivacyChanges();
    expect(readPrivacyPending(owner, role)).toBe("unknown");
    clearPrivacyPending(owner, role);
    expect(readPrivacyPending(owner, role)).toBeUndefined();
  });
  it("removes only page drafts and prevents untracked writes when storage is blocked", () => {
    const mine = draftKey(`${owner}:${role}`, "/admin/privacy", "response"),
      other = draftKey(`${owner}:${role}`, "/admin/support", "other");
    sessionStorage.setItem(mine, "sensitive draft");
    sessionStorage.setItem(other, "kept draft");
    forgetPrivacyDrafts(owner, role);
    expect(sessionStorage.getItem(mine)).toBeNull();
    expect(sessionStorage.getItem(other)).toBe("kept draft");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw Error("Blocked");
    });
    expect(() =>
      markPrivacyPending(owner, role, { kind: "review", request: row(), body: {} }),
    ).toThrow();
  });
});
