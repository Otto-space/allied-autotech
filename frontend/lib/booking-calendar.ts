const nigeriaDayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export const nigeriaDay = (instant: string | number | Date) =>
  nigeriaDayFormat.format(new Date(instant));
export function calendarMonth(month: string) {
  if (!/^(?:19|20|21|22)\d{2}-(?:0[1-9]|1[0-2])$/.test(month))
    throw Error("Invalid calendar month");
  const [year, value] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, value, 1));
  return {
    first: `${month}-01`,
    days: new Date(Date.UTC(year, value, 0)).getUTCDate(),
    weekday: new Date(Date.UTC(year, value - 1, 1)).getUTCDay(),
    from: `${month}-01T00:00:00+01:00`,
    to: `${next.toISOString().slice(0, 10)}T00:00:00+01:00`,
    title: new Intl.DateTimeFormat("en-NG", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, value - 1, 1))),
  };
}
export function shiftCalendarDay(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}
export function shiftCalendarMonth(month: string, amount: number) {
  const date = new Date(`${month}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 7);
}
