import { describe, expect, it } from "vitest";
import { inspectionInstant, mileageLabel } from "../../lib/vehicle-detail";

describe("vehicle detail date and mileage boundaries", () => {
  const now = Date.parse("2026-09-30T09:00:00Z");
  it("interprets the customer's time in Lagos regardless of the device zone", () => {
    expect(inspectionInstant("2026-09-30T10:01", now)).toBe("2026-09-30T09:01:00.000Z");
    expect(inspectionInstant("2026-10-01T00:15", now)).toBe("2026-09-30T23:15:00.000Z");
  });
  it("rejects past, present, malformed and normalized invalid dates", () => {
    for (const value of [
      "",
      "2026-09-30T10:00",
      "2026-09-30T09:59",
      "2027-02-30T10:00",
      "2027-10-01T25:00",
      "2027-10-01T10:00Z",
    ])
      expect(inspectionInstant(value, now)).toBeUndefined();
  });
  it("preserves genuine zero mileage and distinguishes an absent value", () => {
    expect(mileageLabel(0)).toBe("0 km");
    expect(mileageLabel(null)).toBe("Not listed");
    expect(mileageLabel(13000)).toBe("13,000 km");
  });
});
