// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  clearStockDetailPending,
  forgetStockDetailDrafts,
  formatStockInstant,
  markStockDetailPending,
  mergeStockObservation,
  parseStockDetail,
  readStockDetailPending,
  redactStockDetailChanges,
  stockAtLeast,
  stockChangeSnapshot,
  stockDetailPendingKey,
  validateStockChange,
} from "@/lib/admin/work-vehicle-detail";
import { vehicleDefaults, vehicleRecordUpdateBody } from "@/lib/forms/vehicle-record";
import { draftKey, setDraftIdentity } from "@/lib/forms/drafts";
import { stockRecord, bookingId } from "../fixtures/work-vehicle-stock";
const owner = bookingId(302),
  role = "ADMIN",
  raw = () => ({ ...stockRecord(), acquiredAt: "2026-10-17T09:00:37.123Z" });
const row = () => parseStockDetail(raw(), bookingId(7000), role);
const document = () => ({
  id: bookingId(7500),
  type: "REGISTRATION" as const,
  verificationStatus: "PENDING" as const,
  mimeType: "application/pdf",
  sizeBytes: "9007199254740993",
  issuedAt: null,
  expiresAt: null,
  verifiedAt: null,
  rejectionReason: null,
  version: 0,
  createdAt: "2026-10-17T09:00:00.000Z",
});
beforeEach(() => {
  sessionStorage.clear();
  setDraftIdentity(`${owner}:${role}`);
});
afterEach(() => {
  vi.restoreAllMocks();
  setDraftIdentity(null);
});
describe("vehicle detail contracts", () => {
  it("preserves unchanged acquisition seconds/milliseconds while allowing an explicit new minute", () => {
    const current = raw(),
      values = vehicleDefaults(current);
    values.color = "Red";
    const body = vehicleRecordUpdateBody(values, current);
    expect(body.acquiredAt).toBe(current.acquiredAt);
    expect(body.expectedVersion).toBe(0);
    expect(formatStockInstant(body.acquiredAt)).toContain("10:00:37.123");
    values.acquiredAt = "2026-10-17T10:05";
    expect(vehicleRecordUpdateBody(values, current).acquiredAt).toBe(
      "2026-10-17T10:05:00+01:00",
    );
    expect(vehicleRecordUpdateBody(values, current, false)).not.toHaveProperty(
      "acquisitionCostKobo",
    );
  });
  it("validates record identity, role projection, exact byte strings and typed zero findings", () => {
    const r = raw(),
      d = document(),
      report = {
        id: bookingId(7600),
        summary: "Typed findings",
        inspectedAt: "2026-10-17T09:00:37.123Z",
        odometerKm: 0,
        conditionScore: 0,
        findings: { spareKey: false, reading: 0, note: null },
      };
    const parsed = parseStockDetail(
      { ...r, documents: [d], conditionReports: [report] },
      r.id,
      role,
    );
    expect(parsed.documents[0].sizeBytes).toBe("9007199254740993");
    expect(parsed.conditionReports[0].findings).toEqual(report.findings);
    expect(() => parseStockDetail(r, bookingId(999), role)).toThrow();
    expect(() =>
      parseStockDetail({ ...r, acquisitionCostKobo: undefined }, r.id, role),
    ).toThrow();
    expect(() => parseStockDetail(r, r.id, "STAFF", r.branchId)).toThrow();
    const { acquisitionCostKobo: _cost, acquisitionCurrency: _currency, ...safe } = r;
    void _cost;
    void _currency;
    expect(parseStockDetail(safe, r.id, "STAFF", r.branchId).id).toBe(r.id);
    expect(() => parseStockDetail(safe, r.id, "STAFF", bookingId(999))).toThrow();
    expect(() => parseStockDetail({ ...r, documents: [d, d] }, r.id, role)).toThrow();
  });
  it("keeps independent mutation snapshots while checking photo publication constraints", () => {
    const before = row(),
      listing = { ...before.listings[0], priceKobo: "2850000001" },
      later = { ...before, listings: [listing] };
    expect(stockChangeSnapshot(before, { kind: "record" })).toBe(
      stockChangeSnapshot(later, { kind: "record" }),
    );
    expect(stockChangeSnapshot(before, { kind: "listing", id: listing.id })).not.toBe(
      stockChangeSnapshot(later, { kind: "listing", id: listing.id }),
    );
    expect(stockChangeSnapshot(before, { kind: "photo" })).toBe(
      stockChangeSnapshot(later, { kind: "photo" }),
    );
    expect(stockChangeSnapshot(before, { kind: "photo" })).not.toBe(
      stockChangeSnapshot(
        { ...later, listings: [{ ...listing, status: "INACTIVE" }] },
        { kind: "photo" },
      ),
    );
    const d = document();
    expect(
      stockChangeSnapshot({ ...before, documents: [d] }, { kind: "document", id: d.id }),
    ).toBe(
      stockChangeSnapshot(
        { ...before, version: 5, color: "Blue", documents: [d] },
        { kind: "document", id: d.id },
      ),
    );
  });
  it("never replaces a known newer stock/listing/document/report observation with an older read", () => {
    const before = row(),
      d = document(),
      report = {
        id: bookingId(7600),
        summary: "Later report",
        inspectedAt: "2026-10-17T10:00:00Z",
        odometerKm: 0,
        conditionScore: 0,
        findings: null,
      };
    const newer = {
      ...before,
      version: 1,
      color: "Blue",
      listings: [{ ...before.listings[0], version: 2 }],
      documents: [{ ...d, version: 2 }],
      conditionReports: [report],
    };
    const merged = mergeStockObservation(newer, before);
    expect(merged.version).toBe(1);
    expect(merged.color).toBe("Blue");
    expect(merged.listings[0].version).toBe(2);
    expect(merged.documents[0].version).toBe(2);
    expect(merged.conditionReports[0].id).toBe(report.id);
    expect(stockAtLeast(before, newer)).toBe(false);
    expect(stockAtLeast(merged, newer)).toBe(true);
  });
  it("rejects receipts with mismatched identity, scope, values or independent versions", () => {
    const before = row(),
      saved = { ...before, version: 1, color: "Blue" };
    expect(
      validateStockChange(
        { success: true, data: saved },
        {
          kind: "record",
          expectedVersion: 0,
          expected: { color: "Blue", acquiredAt: before.acquiredAt },
        },
        before,
        role,
      ).kind,
    ).toBe("record");
    expect(() =>
      validateStockChange(
        { success: true, data: saved },
        { kind: "record", expectedVersion: 0, expected: { color: "Red" } },
        before,
        role,
      ),
    ).toThrow();
    const listing = {
      ...before.listings[0],
      vehicleId: before.id,
      branchId: before.branchId,
      version: 1,
      priceKobo: "2850000001",
    };
    expect(
      validateStockChange(
        { success: true, data: listing },
        {
          kind: "listing",
          id: listing.id,
          expectedVersion: 0,
          expected: { priceKobo: listing.priceKobo },
        },
        before,
        role,
      ).kind,
    ).toBe("listing");
    expect(() =>
      validateStockChange(
        { success: true, data: { ...listing, vehicleId: bookingId(999) } },
        { kind: "listing", id: listing.id, expectedVersion: 0 },
        before,
        role,
      ),
    ).toThrow();
    expect(() =>
      validateStockChange(
        { success: true, data: { version: 0 } },
        { kind: "photo", expectedVersion: 0 },
        before,
        role,
      ),
    ).toThrow();
    expect(() =>
      validateStockChange(
        { success: true, data: { version: 1, vehicleId: bookingId(999) } },
        { kind: "photo", expectedVersion: 0 },
        before,
        role,
      ),
    ).toThrow();
  });
  it("holds a minimal owner-scoped lock until its token is cleared and redacts it on account invalidation", () => {
    const current = row(),
      key = stockDetailPendingKey(owner, role, current.id),
      value = markStockDetailPending(owner, role, current.id, "listing", 0);
    expect(readStockDetailPending(key)).toEqual(value);
    expect(() => markStockDetailPending(owner, role, current.id, "record", 0)).toThrow();
    expect(() =>
      clearStockDetailPending(owner, role, current.id, bookingId(999)),
    ).toThrow();
    expect(sessionStorage.getItem(key)).not.toContain("Toyota");
    redactStockDetailChanges();
    expect(readStockDetailPending(key)).toBe("unknown");
    clearStockDetailPending(owner, role, current.id);
    expect(readStockDetailPending(key)).toBeUndefined();
  });
  it("clears only the acknowledged account/page drafts during explicit reconciliation", () => {
    const id = bookingId(7000),
      own = draftKey(`${owner}:${role}`, `/admin/vehicles/${id}`, "form-a"),
      other = draftKey(`${owner}:${role}`, `/admin/vehicles/${bookingId(999)}`, "form-b"),
      foreign = draftKey(`${bookingId(999)}:${role}`, `/admin/vehicles/${id}`, "form-c");
    for (const key of [own, other, foreign]) sessionStorage.setItem(key, "{}");
    forgetStockDetailDrafts(owner, role, id);
    expect(sessionStorage.getItem(own)).toBeNull();
    expect(sessionStorage.getItem(other)).toBe("{}");
    expect(sessionStorage.getItem(foreign)).toBe("{}");
    setDraftIdentity(null);
    expect(() => forgetStockDetailDrafts(owner, role, id)).toThrow();
  });
  it("fails closed on corrupt or unavailable recovery storage", () => {
    const key = stockDetailPendingKey(owner, role, bookingId(7000));
    sessionStorage.setItem(key, "corrupt");
    expect(readStockDetailPending(key)).toBe("unknown");
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw Error("Unavailable");
    });
    expect(readStockDetailPending(key)).toBe("unknown");
    expect(() =>
      markStockDetailPending(owner, role, bookingId(7000), "record", 0),
    ).toThrow();
  });
});
