import { expect, it } from "vitest";
import {
  calendarMonth,
  nigeriaDay,
  shiftCalendarDay,
  shiftCalendarMonth,
} from "@/lib/booking-calendar";
it("uses Nigeria boundaries, leap days and year rollover rather than the device timezone", () => {
  expect(nigeriaDay("2026-10-31T23:00:00Z")).toBe("2026-11-01");
  expect(calendarMonth("2028-02")).toMatchObject({
    days: 29,
    from: "2028-02-01T00:00:00+01:00",
    to: "2028-03-01T00:00:00+01:00",
  });
  expect(shiftCalendarDay("2028-02-28", 1)).toBe("2028-02-29");
  expect(shiftCalendarMonth("2026-12", 1)).toBe("2027-01");
  expect(shiftCalendarMonth("2026-01", -1)).toBe("2025-12");
  for (const bad of ["2026-13", "2026-0", "2026-00", "01-2026", "../2026-11"])
    expect(() => calendarMonth(bad)).toThrow();
});
