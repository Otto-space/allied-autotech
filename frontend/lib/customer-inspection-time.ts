const dateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
});
const day = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const time = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  timeStyle: "short",
});
export function inspectionWindow(start: string, end: string | null) {
  const from = new Date(start);
  const to = end ? new Date(end) : null;
  return {
    start: dateTime.format(from),
    end: to ? (day.format(from) === day.format(to) ? time : dateTime).format(to) : null,
  };
}
