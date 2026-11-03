import { describe, expect, it } from "vitest";
import {
  calendarWindowAllowed,
  slotTimingIsCurrent,
} from "../../src/modules/service-operations/booking-slot-timing.js";
const settings = {
  dailyLimit: 5,
  openingDays: [1, 2, 3, 4, 5, 6],
  opensAt: "08:00" as const,
  closesAt: "18:00" as const,
  holidays: [],
  timezone: "Africa/Lagos" as const,
};
describe("truthful slot timing and calendar boundaries", () => {
  it("requires a matching timing revision even when values were later reverted", () => {
    const startsAt = new Date("2040-01-02T09:00:00Z"),
      values = { durationMinutes: 60, preparationMinutes: 0, cleanupMinutes: 20 };
    const slot = {
      ...values,
      startsAt,
      endsAt: new Date("2040-01-02T10:00:00Z"),
      serviceTimingVersion: 0,
    };
    expect(slotTimingIsCurrent(slot, { ...values, timingVersion: 0 })).toBe(true);
    expect(slotTimingIsCurrent(slot, { ...values, timingVersion: 2 })).toBe(false);
    expect(
      slotTimingIsCurrent(
        { ...slot, preparationMinutes: null },
        { ...values, timingVersion: 0 },
      ),
    ).toBe(false);
    expect(
      slotTimingIsCurrent(
        { ...slot, endsAt: new Date("2040-01-02T10:01:00Z") },
        { ...values, timingVersion: 0 },
      ),
    ).toBe(false);
  });
  it("accepts exact opening/closing boundaries but rejects even a millisecond outside", () => {
    const start = new Date("2040-01-02T07:00:00Z"),
      end = new Date("2040-01-02T17:00:00Z");
    expect(calendarWindowAllowed(settings, start, end)).toBe(true);
    expect(calendarWindowAllowed(settings, new Date(start.getTime() - 1), end)).toBe(
      false,
    );
    expect(calendarWindowAllowed(settings, start, new Date(end.getTime() + 1))).toBe(
      false,
    );
  });
  it("respects configured holidays and weekdays rather than assuming every workshop day is open", () => {
    const start = new Date("2040-01-02T08:00:00Z"),
      end = new Date("2040-01-02T09:00:00Z");
    expect(
      calendarWindowAllowed({ ...settings, holidays: ["2040-01-02"] }, start, end),
    ).toBe(false);
    expect(calendarWindowAllowed({ ...settings, openingDays: [6] }, start, end)).toBe(
      false,
    );
    expect(calendarWindowAllowed(settings, start, new Date("2040-01-03T09:00:00Z"))).toBe(
      false,
    );
  });
});
