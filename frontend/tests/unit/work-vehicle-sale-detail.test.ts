// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { salesRecord, bookingId as id } from "../fixtures/work-vehicle-sales";
import {
  clearSalePending,
  forgetSaleDrafts,
  markSalePending,
  mergeSaleObservation,
  parseSaleDetail,
  readSalePending,
  redactSaleChanges,
  saleAtLeast,
  saleChangeSnapshot,
  salePendingKey,
  validateSaleChange,
  type SaleChange,
} from "@/lib/admin/work-vehicle-sale-detail";
import { draftKey, setDraftIdentity } from "@/lib/forms/drafts";
const owner = id(302),
  role = "ADMIN",
  row = () => parseSaleDetail(salesRecord(), id(10000), role),
  reply = (data: unknown) => ({ success: true, data });
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  setDraftIdentity(null);
  vi.restoreAllMocks();
});
describe("transaction detail boundaries", () => {
  it("validates requested identity, Staff scope and immutable history references", () => {
    expect(row().askingPriceKobo).toBe("9999999999999999");
    expect(() => parseSaleDetail(salesRecord(), id(10001), role)).toThrow();
    expect(() => parseSaleDetail(salesRecord(), id(10000), "STAFF", id(103))).toThrow();
    const h = {
      id: id(20000),
      fromStatus: null,
      toStatus: "ENQUIRY",
      reason: null,
      createdAt: "2026-10-17T09:00:37.123Z",
    };
    expect(() =>
      parseSaleDetail({ ...salesRecord(), statusHistory: [h, h] }, id(10000), role),
    ).toThrow();
  });
  it("validates negotiated values and the newly committed public history note", () => {
    const before = row(),
      change: SaleChange = {
        kind: "negotiation",
        expectedVersion: 0,
        body: {
          agreedPriceKobo: "9999999999999999",
          reservationRequiredKobo: null,
          notes: "Reviewed public note",
        },
      },
      saved = {
        ...before,
        version: 1,
        status: "NEGOTIATING",
        agreedPriceKobo: "9999999999999999",
        statusHistory: [
          {
            id: id(20000),
            fromStatus: "ENQUIRY",
            toStatus: "NEGOTIATING",
            reason: "Reviewed public note",
            createdAt: "2026-10-17T10:00:37.123Z",
          },
        ],
      };
    expect(validateSaleChange(reply(saved), change, before, role).version).toBe(1);
    for (const patch of [
      { version: 0 },
      { agreedPriceKobo: "1" },
      { statusHistory: [] },
      { statusHistory: [{ ...saved.statusHistory[0], reason: "Wrong" }] },
    ])
      expect(() =>
        validateSaleChange(reply({ ...saved, ...patch }), change, before, role),
      ).toThrow();
  });
  it("validates exact handover facts and separate revision effects", () => {
    const before = {
        ...row(),
        status: "PAID" as const,
        paidAt: "2026-10-17T09:00:37.123Z",
      },
      body = {
        recipientName: "Synthetic recipient",
        recipientPhone: "+2348000000000",
        odometerKm: 0,
        keysDelivered: 0,
        assetToken: "synthetic-token-".repeat(5),
      },
      handover = {
        id: id(21000),
        status: "PENDING" as const,
        version: 0,
        ...body,
        hasSignedDocument: true,
        readyAt: null,
        completedAt: null,
        cancelledAt: null,
      },
      saved = { ...before, status: "HANDOVER_PENDING" as const, version: 1, handover };
    expect(
      validateSaleChange(reply(saved), { kind: "handover-create", body }, before, role)
        .handover?.odometerKm,
    ).toBe(0);
    expect(() =>
      validateSaleChange(
        reply({ ...saved, handover: { ...handover, keysDelivered: 1 } }),
        { kind: "handover-create", body },
        before,
        role,
      ),
    ).toThrow();
    const ready = {
      ...saved,
      handover: {
        ...handover,
        status: "READY",
        version: 1,
        readyAt: "2026-10-17T10:00:37.123Z",
      },
    };
    expect(
      validateSaleChange(
        reply(ready),
        {
          kind: "handover-status",
          handoverId: handover.id,
          expectedVersion: 0,
          body: { status: "READY" },
        },
        saved,
        role,
      ).version,
    ).toBe(1);
    expect(() =>
      validateSaleChange(
        reply({ ...ready, version: 2 }),
        {
          kind: "handover-status",
          handoverId: handover.id,
          expectedVersion: 0,
          body: { status: "READY" },
        },
        saved,
        role,
      ),
    ).toThrow();
    const complete = {
      ...ready,
      status: "COMPLETED",
      version: 2,
      vehicleListing: { ...ready.vehicleListing, status: "SOLD" },
      handover: {
        ...ready.handover,
        status: "COMPLETED",
        version: 2,
        completedAt: "2026-10-17T11:00:37.123Z",
      },
    };
    expect(
      validateSaleChange(
        reply(complete),
        {
          kind: "handover-status",
          handoverId: handover.id,
          expectedVersion: 1,
          body: { status: "COMPLETED" },
        },
        parseSaleDetail(ready, before.id, role),
        role,
      ).version,
    ).toBe(2);
  });
  it("keeps newer sale/handover/history while independent domains do not invalidate review", () => {
    const before = row(),
      h = {
        id: id(22000),
        fromStatus: null,
        toStatus: "ENQUIRY" as const,
        reason: null,
        createdAt: "2026-10-17T09:00:00Z",
      },
      later = { ...before, version: 1, statusHistory: [h] },
      merged = mergeSaleObservation(later, before);
    expect(merged.version).toBe(1);
    expect(merged.statusHistory).toHaveLength(1);
    expect(saleAtLeast(before, later)).toBe(false);
    const change: SaleChange = { kind: "negotiation", body: {} };
    expect(saleChangeSnapshot(before, change)).toBe(
      saleChangeSnapshot({ ...before, statusHistory: [h] }, change),
    );
  });
  it("persists only minimal owned pending metadata and redacts without unlocking", () => {
    const marker = markSalePending(owner, role, id(10000), "negotiation", 0),
      key = salePendingKey(owner, role, id(10000));
    expect(Object.keys(JSON.parse(sessionStorage.getItem(key)!)).sort()).toEqual([
      "kind",
      "token",
      "version",
    ]);
    expect(() => markSalePending(owner, role, id(10000), "progress", 0)).toThrow();
    expect(() => clearSalePending(owner, role, id(10000), id(9))).toThrow();
    clearSalePending(owner, role, id(10000), marker.token);
    expect(readSalePending(owner, role, id(10000))).toBeUndefined();
    markSalePending(owner, role, id(10000), "progress", 0);
    redactSaleChanges();
    expect(sessionStorage.getItem(key)).toBe("pending");
    expect(readSalePending(owner, role, id(10000))).toBe("unknown");
  });
  it("reconciliation clears only this actor and transaction's form drafts", () => {
    const own = draftKey(`${owner}:${role}`, `/admin/vehicle-sales/${id(10000)}`, "form"),
      other = draftKey(`${owner}:${role}`, `/admin/vehicle-sales/${id(10001)}`, "form");
    for (const key of [own, other]) sessionStorage.setItem(key, "{}");
    forgetSaleDrafts(owner, role, id(10000));
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(other)).toBe("{}");
  });
  it("fails closed when recovery storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("blocked");
    });
    expect(readSalePending(owner, role, id(10000))).toBe("unknown");
    expect(() => markSalePending(owner, role, id(10000), "progress", 0)).toThrow();
  });
});
