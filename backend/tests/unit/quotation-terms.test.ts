import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "../../src/generated/prisma/client.js";
import { quotationTerms } from "../../src/modules/policies/quotation-terms.js";

const issuedAt = new Date("2026-11-03T10:00:00Z");
function database(settings: unknown, approvalStatus = "APPROVED") {
  return {
    businessPolicyVersion: {
      findFirst: vi.fn().mockResolvedValue({
        id: "a2400000-0000-4000-8000-000000000007",
        key: "quotation",
        version: 1,
        approvalStatus,
        source: "Synthetic reviewed policy fixture",
        effectiveAt: new Date("2026-09-22T00:00:00Z"),
        settings,
      }),
    },
  } as unknown as Prisma.TransactionClient;
}

describe("approved quotation validity", () => {
  it("uses exactly seven days from issuance and retains its policy provenance", async () => {
    const result = await quotationTerms(
      database({ validityDays: 7, shorterOverride: false }),
      issuedAt,
    );
    expect(result.expiresAt.toISOString()).toBe("2026-11-10T10:00:00.000Z");
    expect(result.issuedAt).toEqual(issuedAt);
    expect(result.snapshot).toMatchObject({
      key: "quotation",
      version: 1,
      approvalStatus: "APPROVED",
    });
  });
  it.each([
    null,
    {},
    { validityDays: 30, shorterOverride: false },
    { validityDays: 7, shorterOverride: true },
  ])("fails closed for unrecognised terms %j", async (settings) => {
    await expect(quotationTerms(database(settings), issuedAt)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
  it("requires actual approved policy even when its proposed settings look correct", async () => {
    await expect(
      quotationTerms(
        database({ validityDays: 7, shorterOverride: false }, "DRAFT"),
        issuedAt,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});
