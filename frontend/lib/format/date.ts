export function formatBusinessDate(value: string | null | undefined): string {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return (
    new Intl.DateTimeFormat("en-NG", {
      timeZone: "Africa/Lagos",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date) + " (Lagos time)"
  );
}
