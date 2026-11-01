import { formatBusinessDate } from "./format/date";

export const bookingReferenceLabel = (id: string) => `#${id.slice(-8).toUpperCase()}`;

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
