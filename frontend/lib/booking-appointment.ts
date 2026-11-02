import { formatBusinessDate } from "./format/date";

export const bookingReferenceLabel = (id: string) => `#${id.slice(-8).toUpperCase()}`;

/** Elapsed time is informational; it cannot confirm or advance a booking. */
export function appointmentCountdown(
  status: string,
  scheduledAt: string | null | undefined,
  now: number,
): string | null {
  if (status !== "CONFIRMED" || !scheduledAt || !Number.isFinite(now)) return null;
  const remaining = Date.parse(scheduledAt) - now;
  if (!Number.isFinite(remaining) || remaining <= 0) return null;
  if (remaining < 60_000) return "Starts in less than a minute";
  const minutes = Math.ceil(remaining / 60_000);
  const units = [
    [Math.floor(minutes / 1440), "day"],
    [Math.floor((minutes % 1440) / 60), "hour"],
    [minutes % 60, "minute"],
  ] as const;
  return `Starts in ${units
    .filter(([value]) => value > 0)
    .map(([value, unit]) => `${value} ${unit}${value === 1 ? "" : "s"}`)
    .join(", ")}`;
}

const calendarFormatter = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function appointmentCalendarDate(scheduledAt: string | null | undefined) {
  if (!scheduledAt || !Number.isFinite(Date.parse(scheduledAt))) return null;
  const parts = calendarFormatter.formatToParts(new Date(scheduledAt));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)!.value;
  return {
    month: part("month"),
    day: part("day"),
    year: part("year"),
  };
}

const localDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const localTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** A reminder describes confirmed future time; it never advances booking status. */
export function upcomingAppointment(
  status: string,
  scheduledAt: string | null | undefined,
  now: number,
): string | null {
  if (status !== "CONFIRMED" || !scheduledAt || !Number.isFinite(now)) return null;
  const appointment = Date.parse(scheduledAt);
  if (!Number.isFinite(appointment) || appointment <= now) return null;
  const day = localDay.format(appointment);
  const relative =
    day === localDay.format(now)
      ? "today"
      : day === localDay.format(now + 86_400_000)
        ? "tomorrow"
        : null;
  return relative
    ? `Your appointment is ${relative} at ${localTime.format(appointment)} (Nigeria time).`
    : `Your appointment is on ${formatBusinessDate(scheduledAt)}.`;
}
