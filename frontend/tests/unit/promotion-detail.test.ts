// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPromotionPending,
  markPromotionPending,
  parsePromotionDetail,
  pendingPromotionKey,
  promotionSnapshot,
  readPromotionPending,
} from "@/lib/admin/promotion-detail";
import { promotionRecord, bookingId } from "../fixtures/work-promotions";
import { setDraftIdentity } from "@/lib/forms/drafts";
const owner = bookingId(302),
  role = "ADMIN",
  record = promotionRecord(),
  key = pendingPromotionKey(owner, role, record.id);
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
describe("promotion detail contract and pending state", () => {
  it("binds strict complete settings to the requested ID", () => {
    expect(parsePromotionDetail(record, record.id)).toEqual(record);
    for (const change of [
      { id: bookingId(999) },
      { endsAt: record.startsAt },
      { usageLimit: 1, perCustomerLimit: 2 },
      { description: "x".repeat(2001) },
      { version: -1 },
      { percentageBasisPoints: null },
      { code: "" },
    ])
      expect(() => parsePromotionDetail({ ...record, ...change }, record.id)).toThrow();
  });
  it("compares every saved setting including precise dates and metadata", () => {
    const before = promotionSnapshot(record);
    for (const change of [
      { version: 1 },
      { endsAt: "2026-10-31T22:59:37.201Z" },
      { code: null },
      { name: "Changed" },
      { isActive: false },
      { maximumDiscountAmountKobo: "0" },
    ])
      expect(promotionSnapshot({ ...record, ...change })).not.toBe(before);
  });
  it("stores only expected version and isolates role/owner/record markers", () => {
    markPromotionPending(owner, role, record.id, 3);
    expect(readPromotionPending(key)).toEqual({ version: 3 });
    expect(sessionStorage.getItem(key)).toBe('{"version":3}');
    expect(
      readPromotionPending(pendingPromotionKey(owner, "SUPER_ADMIN", record.id)),
    ).toBeUndefined();
    expect(
      readPromotionPending(pendingPromotionKey(bookingId(303), role, record.id)),
    ).toBeUndefined();
    setDraftIdentity(`${owner}:STAFF`);
    expect(() => markPromotionPending(owner, role, record.id, 4)).toThrow();
  });
  it("keeps corrupt or unexpected pending values locked until explicit recovery", () => {
    for (const value of [
      "pending",
      '{"version":-1}',
      '{"version":1,"name":"private"}',
      "x".repeat(101),
    ]) {
      sessionStorage.setItem(key, value);
      expect(readPromotionPending(key)).toBe("unknown");
    }
    clearPromotionPending(key);
    expect(readPromotionPending(key)).toBeUndefined();
  });
});
