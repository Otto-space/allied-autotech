import { expect, it } from "vitest";
import { isCurrentBookingReminder } from "../../src/workers/booking-reminder-current.js";

const now = new Date("2030-05-01T08:00:00Z").getTime();
const booking = {
  status: "CONFIRMED",
  scheduleVersion: 4,
  scheduledAt: new Date(now + 1),
};

it("accepts the current confirmed appointment only while its time is future", () => {
  expect(isCurrentBookingReminder(booking, 4, now)).toBe(true);
  for (const milliseconds of [0, -1, -3_600_000])
    expect(
      isCurrentBookingReminder(
        { ...booking, scheduledAt: new Date(now + milliseconds) },
        4,
        now,
      ),
    ).toBe(false);
});

it("rejects a missing, superseded or no longer confirmed appointment", () => {
  expect(isCurrentBookingReminder(null, 4, now)).toBe(false);
  expect(isCurrentBookingReminder(booking, 3, now)).toBe(false);
  for (const status of ["REQUESTED", "CANCELLED", "COMPLETED", "NO_SHOW"])
    expect(isCurrentBookingReminder({ ...booking, status }, 4, now)).toBe(false);
});
