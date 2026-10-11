import { describe, expect, it } from "vitest";
import { customerInspectionQuery } from "@/lib/customer-inspection-query";
import { parseCustomerInspections } from "@/lib/api/customer-inspections-schema";
import { inspectionRecord, inspectionId } from "../fixtures/customer-inspections";
import { inspectionWindow } from "@/lib/customer-inspection-time";

it("formats ranges by the Lagos calendar date, including UTC midnight boundaries", () => {
  expect(inspectionWindow("2026-10-15T09:00:00Z", "2026-10-15T10:00:00Z")).toEqual({
    start: "15 Oct 2026, 10:00",
    end: "11:00",
  });
  expect(inspectionWindow("2026-10-15T22:30:00Z", "2026-10-15T23:30:00Z")).toEqual({
    start: "15 Oct 2026, 23:30",
    end: "16 Oct 2026, 00:30",
  });
  expect(inspectionWindow("2026-10-15T23:30:00Z", "2026-10-16T00:30:00Z")).toEqual({
    start: "16 Oct 2026, 00:30",
    end: "01:30",
  });
});

describe("customer inspection navigation boundary", () => {
  it("forwards only bounded supported API fields and keeps history client-side", () => {
    const query = customerInspectionQuery(
      new URLSearchParams(
        `status=COMPLETED&limit=10&cursor=${inspectionId(4)}&_trail=start&customerId=${inspectionId(900)}&search=private`,
      ),
    );
    expect(query.path).toBe(
      `/customers/vehicle-inspections?status=COMPLETED&limit=10&cursor=${inspectionId(4)}`,
    );
    expect(query.params.get("_trail")).toBe("start");
  });
  it("rejects invalid filters and cursor history without blocking a safe first read", () => {
    const query = customerInspectionQuery(
      new URLSearchParams("status=PAID&limit=1000&cursor=bad&_trail=bad"),
    );
    expect(query.invalid).toBe(true);
    expect(query.path).toBe("/customers/vehicle-inspections?limit=20");
    expect(query.params.has("_trail")).toBe(false);
  });
  it("bounds navigation history without inventing a page number", () => {
    const query = customerInspectionQuery(
      new URLSearchParams(
        `cursor=${inspectionId(4)}&_trail=start,${Array(51).fill(inspectionId(3)).join(",")}`,
      ),
    );
    expect(query.params.has("cursor")).toBe(true);
    expect(query.params.has("_trail")).toBe(false);
  });
});

describe("customer inspection response boundary", () => {
  it("preserves actual report values including zero, false and null findings", () => {
    const record = inspectionRecord(3, "COMPLETED");
    const parsed = parseCustomerInspections({
      items: [
        {
          ...record,
          conditionReport: {
            ...record.conditionReport,
            conditionScore: 0,
            odometerKm: 0,
            findings: { roadTest: false, other: null },
          },
        },
      ],
    });
    expect(parsed.items[0].conditionReport).toMatchObject({
      conditionScore: 0,
      odometerKm: 0,
      findings: { roadTest: false, other: null },
    });
  });
  it.each([
    { status: "PAID" },
    { preferredStartAt: "not-a-date" },
    { scheduledStartAt: "tomorrow" },
  ])("rejects unsupported appointment data %j", (patch) => {
    expect(() =>
      parseCustomerInspections({ items: [{ ...inspectionRecord(), ...patch }] }),
    ).toThrow();
  });
  it("rejects unsafe cursors, duplicate identities and unbounded pages", () => {
    expect(() =>
      parseCustomerInspections({ items: [], nextCursor: "//elsewhere" }),
    ).toThrow();
    expect(() =>
      parseCustomerInspections({ items: [inspectionRecord(), inspectionRecord()] }),
    ).toThrow();
    expect(() =>
      parseCustomerInspections({
        items: Array.from({ length: 51 }, (_, n) => inspectionRecord(n + 1)),
      }),
    ).toThrow();
  });
});
