// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppointmentTiming } from "@/app/components/appointment-timing";
import { appointmentCalendarDate, appointmentCountdown } from "@/lib/booking-appointment";

const now = Date.parse("2026-12-31T22:30:00Z");
const future = new Date(now + 90_000).toISOString();
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("counts confirmed future elapsed time with honest minute and day boundaries", () => {
  expect(appointmentCountdown("CONFIRMED", future, now)).toBe("Starts in 2 minutes");
  expect(appointmentCountdown("CONFIRMED", future, now + 60_000)).toBe(
    "Starts in less than a minute",
  );
  expect(appointmentCountdown("CONFIRMED", future, now + 90_000)).toBeNull();
  expect(
    appointmentCountdown("CONFIRMED", new Date(now + 90_060_000).toISOString(), now),
  ).toBe("Starts in 1 day, 1 hour, 1 minute");
});

it("never counts requests, other statuses, missing, invalid or past schedules", () => {
  for (const status of [
    "REQUESTED",
    "AWAITING_DEPOSIT",
    "IN_PROGRESS",
    "COMPLETED",
    "CANCELLED",
    "EXPIRED",
    "NO_SHOW",
  ])
    expect(appointmentCountdown(status, future, now)).toBeNull();
  for (const at of [null, "", "invalid", new Date(now - 1).toISOString()])
    expect(appointmentCountdown("CONFIRMED", at, now)).toBeNull();
  expect(appointmentCountdown("CONFIRMED", future, NaN)).toBeNull();
});

it("uses Nigeria calendar dates across the year boundary without inventing a date", () => {
  expect(appointmentCalendarDate("2026-12-31T23:30:00Z")).toEqual({
    month: "Jan",
    day: "1",
    year: "2027",
  });
  expect(appointmentCalendarDate(null)).toBeNull();
  expect(appointmentCalendarDate("invalid")).toBeNull();
});

it("keeps the absolute date, suppresses stale countdowns and makes no live announcements", () => {
  const view = render(
    <AppointmentTiming status="CONFIRMED" scheduledAt={future} now={now} />,
  );
  expect(screen.getByRole("timer").getAttribute("aria-live")).toBe("off");
  expect(screen.getByText(/Lagos time/)).toBeTruthy();
  view.rerender(
    <AppointmentTiming
      status="CONFIRMED"
      scheduledAt={future}
      now={now}
      current={false}
    />,
  );
  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.getByText(/Lagos time/)).toBeTruthy();
  view.rerender(<AppointmentTiming status="REQUESTED" scheduledAt={future} now={now} />);
  expect(screen.queryByRole("timer")).toBeNull();
  view.rerender(
    <AppointmentTiming status="CONFIRMED" scheduledAt={future} now={now + 90_000} />,
  );
  expect(screen.queryByRole("timer")).toBeNull();
});

it("updates the dashboard clock through expiry and clears its timer on unmount", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const view = render(<AppointmentTiming status="CONFIRMED" scheduledAt={future} />);
  await act(async () => {});
  expect(screen.getByRole("timer").textContent).toBe("Starts in 2 minutes");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(screen.getByRole("timer").textContent).toBe("Starts in less than a minute");
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30_000);
  });
  expect(screen.queryByRole("timer")).toBeNull();
  expect(
    screen.getByText(
      "Appointment time has arrived. The workshop will update its status.",
    ),
  ).toBeTruthy();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("refreshes elapsed time on focus after time away", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  render(<AppointmentTiming status="CONFIRMED" scheduledAt={future} />);
  await act(async () => {});
  expect(screen.getByRole("timer")).toBeTruthy();
  vi.setSystemTime(now + 120_000);
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(screen.queryByRole("timer")).toBeNull();
});

it("keeps missing and invalid appointment times explicit without a countdown", () => {
  const view = render(
    <AppointmentTiming status="REQUESTED" scheduledAt={null} now={now} />,
  );
  expect(screen.getByText("Time not assigned")).toBeTruthy();
  expect(screen.queryByRole("timer")).toBeNull();
  view.rerender(<AppointmentTiming status="CONFIRMED" scheduledAt="invalid" now={now} />);
  expect(screen.getByText("Date unavailable")).toBeTruthy();
  expect(screen.queryByRole("timer")).toBeNull();
});
