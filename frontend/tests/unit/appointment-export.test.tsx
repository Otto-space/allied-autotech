// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { appointmentExport } from "@/lib/appointment-export";
import { AppointmentExport } from "@/app/components/appointment-export";
const now = Date.parse("2026-11-03T08:00:00Z");
const booking = {
  id: "11111111-1111-4111-8111-111111111111",
  version: 3,
  status: "CONFIRMED",
  scheduledAt: "2026-11-04T10:00:00+01:00",
};
afterEach(cleanup);
it("exports the confirmed absolute time, stable UID and version without guessing completion", () => {
  const event = appointmentExport(booking, now)!;
  expect(event.calendar).toContain("DTSTART:20261104T090000Z");
  expect(event.calendar).toContain(`UID:booking-${booking.id}@alliedautotech.com`);
  expect(event.calendar).toContain("SEQUENCE:3");
  expect(event.calendar).not.toContain("DTEND:");
  expect(
    event.calendar
      .split("\r\n")
      .every((line) => new TextEncoder().encode(line).length <= 75),
  ).toBe(true);
  const url = new URL(event.googleUrl);
  expect(url.searchParams.get("ctz")).toBe("Africa/Lagos");
  expect(url.searchParams.get("dates")).toBe("20261104T090000Z/20261104T090000Z");
});
it.each(["REQUESTED", "CANCELLED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"])(
  "never exports %s as confirmed",
  (status) => {
    expect(appointmentExport({ ...booking, status }, now)).toBeNull();
  },
);
it("rejects past, invalid and injected event inputs", () => {
  expect(appointmentExport(booking, Date.parse(booking.scheduledAt))).toBeNull();
  expect(appointmentExport({ ...booking, scheduledAt: "invalid" }, now)).toBeNull();
  expect(appointmentExport({ ...booking, id: "bad\r\nBEGIN:VEVENT" }, now)).toBeNull();
});
it("offers explicit download and Google actions only for current confirmed records", () => {
  const view = render(<AppointmentExport booking={booking} now={now} current />);
  expect(
    screen.getByRole("link", { name: "Add to calendar (.ics)" }).getAttribute("download"),
  ).toContain(".ics");
  expect(
    screen.getByRole("link", { name: "Google Calendar (new tab)" }).getAttribute("rel"),
  ).toContain("noopener");
  view.rerender(<AppointmentExport booking={booking} now={now} current={false} />);
  expect(screen.queryByRole("link")).toBeNull();
});
