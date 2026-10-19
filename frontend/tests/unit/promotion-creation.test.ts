// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPromotionCreation,
  newPromotionCreation,
  parsePromotionReceipt,
  promotionCreationActive,
  readPromotionCreation,
  redactPromotionCreations,
  savePromotionCreation,
} from "@/lib/admin/promotion-creation";
import { setDraftIdentity } from "@/lib/forms/drafts";
import { promotionBody, promotionDefaults } from "@/lib/forms/promotion";
const owner = "d1000000-0000-4000-8000-000000000302",
  role = "ADMIN";
const values = () => ({
  ...promotionDefaults(),
  name: "Exact offer",
  percentage: "12.34",
  startsAt: "2026-10-17T10:00:37.123",
  endsAt: "2026-11-17T10:00:37.456",
  minimumOrderAmount: "0",
  maximumDiscountAmount: "99999999999999.99",
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
describe("promotion creation recovery", () => {
  it("retains exact canonical values and a timestamped key across reload reads", () => {
    const intent = newPromotionCreation(owner, role, values());
    savePromotionCreation(intent);
    expect(readPromotionCreation(owner, role)).toEqual(intent);
    expect(promotionBody(intent.values)).toMatchObject({
      isActive: false,
      code: null,
      percentageBasisPoints: 1234,
      minimumOrderAmountKobo: "0",
      maximumDiscountAmountKobo: "9999999999999999",
      startsAt: "2026-10-17T10:00:37.123+01:00",
    });
    expect(promotionCreationActive(intent.key)).toBe(true);
    expect(
      promotionCreationActive(intent.key, Number(intent.key.split(".")[1]) + 86_400_000),
    ).toBe(false);
  });
  it("binds storage to account and role and rejects mismatched active identity", () => {
    const intent = newPromotionCreation(owner, role, values());
    savePromotionCreation(intent);
    expect(readPromotionCreation(owner, "SUPER_ADMIN")).toBeUndefined();
    setDraftIdentity(`${owner}:STAFF`);
    expect(() => savePromotionCreation(intent)).toThrow();
  });
  it("redacts input on invalidation while retaining the uncertainty lock", () => {
    savePromotionCreation(newPromotionCreation(owner, role, values()));
    redactPromotionCreations();
    expect(readPromotionCreation(owner, role)).toBe("history");
    expect(JSON.stringify(sessionStorage)).not.toContain("Exact offer");
  });
  it("retains a minimal confirmed receipt and validates read-only response binding", () => {
    const intent = newPromotionCreation(owner, role, values()),
      promotionId = "d1000000-0000-4000-8000-000000006000";
    savePromotionCreation({
      owner,
      role,
      key: intent.key,
      kind: "confirmed",
      promotionId,
    });
    expect(readPromotionCreation(owner, role)).toEqual({
      owner,
      role,
      key: intent.key,
      kind: "confirmed",
      promotionId,
    });
    expect(JSON.stringify(sessionStorage)).not.toContain("Exact offer");
    expect(
      parsePromotionReceipt({ key: intent.key, promotionId }, intent.key).promotionId,
    ).toBe(promotionId);
    expect(() =>
      parsePromotionReceipt({ key: intent.key, promotionId }, "wrong"),
    ).toThrow();
    clearPromotionCreation(owner, role);
    expect(readPromotionCreation(owner, role)).toBeUndefined();
  });
});
