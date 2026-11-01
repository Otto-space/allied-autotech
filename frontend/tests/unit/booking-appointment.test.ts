import { describe, expect, it } from "vitest";
import { upcomingAppointment } from "../../lib/booking-appointment";

describe("confirmed appointment summaries in Nigeria time", () => {
  const now = Date.parse("2026-11-01T22:30:00Z");
  it("uses local calendar days across midnight and year boundaries", () => {
    expect(upcomingAppointment("CONFIRMED", "2026-11-02T09:00:00Z", now)).toMatch(
      /tomorrow at 10:00 am/i,
    );
    expect(upcomingAppointment("CONFIRMED", "2026-11-01T23:30:00Z", now)).toMatch(
      /tomorrow at 12:30 am/i,
    );
    expect(
      upcomingAppointment(
        "CONFIRMED",
        "2027-01-01T09:00:00Z",
        Date.parse("2026-12-31T20:00:00Z"),
      ),
    ).toContain("tomorrow");
  });
  it("shows today or an explicit future date without a countdown", () => {
    expect(upcomingAppointment("CONFIRMED", "2026-11-01T22:45:00Z", now)).toContain(
      "today",
    );
    expect(upcomingAppointment("CONFIRMED", "2026-11-04T09:00:00Z", now)).toContain(
      "Lagos time",
    );
  });
  it("never treats pending, cancelled or completed work as upcoming confirmation", () => {
    for (const status of [
      "REQUESTED",
      "AWAITING_DEPOSIT",
      "CANCELLED",
      "COMPLETED",
      "IN_PROGRESS",
      "NO_SHOW",
      "EXPIRED",
    ])
      expect(upcomingAppointment(status, "2026-11-02T09:00:00Z", now)).toBeNull();
    for (const value of [null, "invalid", "2026-11-01T22:30:00Z", "2026-10-31T09:00:00Z"])
      expect(upcomingAppointment("CONFIRMED", value, now)).toBeNull();
  });
});
