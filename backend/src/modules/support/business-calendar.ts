export interface BusinessCalendar {
  days: readonly number[];
  openMinute: number;
  closeMinute: number;
  holidays: readonly string[];
}
export const ownerSupportCalendar: BusinessCalendar = {
  days: [1, 2, 3, 4, 5, 6],
  openMinute: 480,
  closeMinute: 1080,
  holidays: [],
};

/** Africa/Lagos uses UTC+01:00. Stores and returns UTC instants. */
export function addBusinessMinutes(
  start: Date,
  minutes: number,
  calendar: BusinessCalendar,
): Date {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isInteger(minutes) ||
    minutes < 0 ||
    minutes > 100_000 ||
    calendar.openMinute >= calendar.closeMinute ||
    calendar.days.length === 0
  )
    throw new Error("Invalid business calendar");
  let cursor = new Date(start);
  let remaining = minutes * 60_000;
  for (let dayCount = 0; dayCount < 1000; dayCount++) {
    const local = new Date(cursor.getTime() + 3_600_000);
    const date = local.toISOString().slice(0, 10);
    const midnight = new Date(`${date}T00:00:00+01:00`).getTime();
    const opens = midnight + calendar.openMinute * 60_000;
    const closes = midnight + calendar.closeMinute * 60_000;
    if (
      calendar.days.includes(local.getUTCDay()) &&
      !calendar.holidays.includes(date) &&
      cursor.getTime() < closes
    ) {
      const from = Math.max(cursor.getTime(), opens);
      const available = closes - from;
      if (remaining <= available) return new Date(from + remaining);
      remaining -= available;
    }
    cursor = new Date(midnight + 86_400_000);
  }
  throw new Error("Business calendar does not provide sufficient working time");
}
