import { describe, expect, it } from "vitest";
import { parseCustomerPurchaseDetail } from "@/lib/api/customer-purchase-detail-schema";
import { detailRecord, purchaseId } from "../fixtures/customer-purchase-detail";
describe("owned purchase detail response boundary", () => {
  it("preserves exact money and explicit zero handover values", () => {
    const record = detailRecord();
    record.agreedPriceKobo = "9007199254740993";
    record.handover = {
      id: purchaseId(800),
      status: "READY",
      recipientName: null,
      odometerKm: 0,
      keysDelivered: 0,
      readyAt: null,
      completedAt: null,
    };
    const parsed = parseCustomerPurchaseDetail(record);
    expect(parsed.agreedPriceKobo).toBe("9007199254740993");
    expect(parsed.handover?.odometerKm).toBe(0);
    expect(parsed.handover?.keysDelivered).toBe(0);
  });
  it.each([
    "createdAt",
    "reservationExpiresAt",
    "termsAcceptedAt",
    "paidAt",
    "paidHoldStartsAt",
    "paidHoldExpiresAt",
  ])("rejects invalid %s", (key) => {
    expect(() =>
      parseCustomerPurchaseDetail({ ...detailRecord(), [key]: "invalid" }),
    ).toThrow();
  });
  it("rejects unknown history states and duplicate event identities", () => {
    const record = detailRecord();
    expect(() =>
      parseCustomerPurchaseDetail({
        ...record,
        statusHistory: [{ ...record.statusHistory[0], toStatus: "MADE_UP" }],
      }),
    ).toThrow();
    expect(() =>
      parseCustomerPurchaseDetail({
        ...record,
        statusHistory: [record.statusHistory[0], record.statusHistory[0]],
      }),
    ).toThrow();
  });
  it("accepts absent historical photography without manufacturing inventory", () => {
    const record = detailRecord();
    record.vehicleListing.vehicle = undefined;
    expect(parseCustomerPurchaseDetail(record).vehicleListing.vehicle).toBeUndefined();
  });
});
