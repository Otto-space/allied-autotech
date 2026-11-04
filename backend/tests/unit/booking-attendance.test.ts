import { describe, it, expect } from "vitest";
import {
  assertAttendanceAction,
  attendanceCheckAt,
  bookingAttendanceBodySchema,
} from "../../src/modules/service-operations/booking-attendance.js";
const now = new Date("2026-11-04T12:00:00Z"),
  booking = {
    id: "00000000-0000-4000-8000-000000000001",
    branchId: null,
    scheduledAt: new Date("2026-11-04T11:45:00Z"),
    status: "CONFIRMED",
    startedAt: null,
    scheduleVersion: 0,
    version: 0,
  };
describe("physical attendance rules", () => {
  it("opens a staff check exactly at the delegated grace boundary", () => {
    expect(attendanceCheckAt(booking.scheduledAt, 15)).toEqual(now);
    expect(() =>
      assertAttendanceAction(booking, "ABSENCE_CONFIRMED", null, false, 15, now),
    ).not.toThrow();
    expect(() =>
      assertAttendanceAction(
        booking,
        "ABSENCE_CONFIRMED",
        null,
        false,
        15,
        new Date(now.getTime() - 1),
      ),
    ).toThrow(/not been reached/);
  });
  it("uses configured grace without applying a penalty", () => {
    expect(() =>
      assertAttendanceAction(booking, "ABSENCE_CONFIRMED", null, false, 30, now),
    ).toThrow();
    expect(() =>
      assertAttendanceAction(booking, "ABSENCE_CONFIRMED", null, false, 0, now),
    ).not.toThrow();
  });
  it.each(["ARRIVED", "WAITING", "LEFT"])(
    "never calls a recorded %s visit absent",
    (state) =>
      expect(() =>
        assertAttendanceAction(booking, "ABSENCE_CONFIRMED", state, true, 15, now),
      ).toThrow(/arrival/),
  );
  it.each(["IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"])(
    "rejects attendance changes to %s",
    (status) =>
      expect(() =>
        assertAttendanceAction({ ...booking, status }, "ARRIVED", null, false, 15, now),
      ).toThrow(/unstarted/),
  );
  it("honours a recorded work start even with a stale confirmed status", () =>
    expect(() =>
      assertAttendanceAction(
        { ...booking, startedAt: now },
        "ABSENCE_CONFIRMED",
        null,
        false,
        15,
        now,
      ),
    ).toThrow(/unstarted/));
  it("requires arrival before waiting/leaving and permits a recorded return", () => {
    for (const kind of ["WAITING", "LEFT"] as const)
      expect(() => assertAttendanceAction(booking, kind, null, false, 15, now)).toThrow(
        /arrival/,
      );
    expect(() =>
      assertAttendanceAction(booking, "ARRIVED", "LEFT", true, 15, now),
    ).not.toThrow();
    expect(() =>
      assertAttendanceAction(booking, "ARRIVED", "WAITING", true, 15, now),
    ).toThrow(/already/);
  });
  it("requires a factual note for an absence check and rejects control characters", () => {
    const base = {
      operationId: booking.id,
      expectedVersion: 0,
      kind: "ABSENCE_CONFIRMED",
    };
    expect(bookingAttendanceBodySchema.safeParse(base).success).toBe(false);
    expect(
      bookingAttendanceBodySchema.safeParse({
        ...base,
        reason: "Checked reception and contacted the customer",
      }).success,
    ).toBe(true);
    expect(
      bookingAttendanceBodySchema.safeParse({ ...base, reason: "bad\nreason" }).success,
    ).toBe(false);
  });
});
