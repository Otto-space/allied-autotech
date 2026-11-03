import { business } from "./business";

export type AppointmentExportInput = {
  id: string;
  version: number;
  status: string;
  scheduledAt: string | null;
};
const utc = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
const escapeText = (text: string) =>
  text
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n|\r/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");

// RFC 5545 folds at 75 octets, without splitting a UTF-8 character.
function fold(line: string) {
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const character of line) {
    const bytes = new TextEncoder().encode(character).length;
    if (size + bytes > 75) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += character;
    size += bytes;
  }
  lines.push(current);
  return lines.join("\r\n");
}

/** An arrival event, without an invented job duration or private booking notes. */
export function appointmentExport(booking: AppointmentExportInput, now: number) {
  const start = booking.scheduledAt ? Date.parse(booking.scheduledAt) : NaN;
  if (
    booking.status !== "CONFIRMED" ||
    !Number.isFinite(now) ||
    !Number.isFinite(start) ||
    start <= now ||
    !/^[0-9a-f-]{36}$/i.test(booking.id) ||
    !Number.isSafeInteger(booking.version) ||
    booking.version < 0
  )
    return null;
  const date = utc(new Date(start));
  const title = "Allied AutoTech appointment";
  const details =
    "Confirmed arrival time (Nigeria time). Check your Allied booking for changes. This event does not promise a job completion or collection time.";
  const calendar =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Allied AutoTech//Appointments//EN",
      "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT",
      `UID:booking-${booking.id}@alliedautotech.com`,
      `SEQUENCE:${booking.version}`,
      `DTSTAMP:${utc(new Date(now))}`,
      `DTSTART:${date}`,
      "STATUS:CONFIRMED",
      `SUMMARY:${escapeText(title)}`,
      `LOCATION:${escapeText(business.address)}`,
      `DESCRIPTION:${escapeText(details)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .map(fold)
      .join("\r\n") + "\r\n";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${date}/${date}`,
    ctz: "Africa/Lagos",
    location: business.address,
    details,
  });
  return {
    calendar,
    googleUrl: `https://calendar.google.com/calendar/render?${params}`,
    filename: `allied-appointment-${booking.id.slice(-8)}.ics`,
  };
}
