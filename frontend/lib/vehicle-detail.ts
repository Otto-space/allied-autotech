export function inspectionInstant(value: string, now = Date.now()): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return;
  const date = new Date(`${value}:00+01:00`);
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now) return;
  // Reject normalized invalid dates, independently of the browser's date control.
  if (new Date(date.getTime() + 3_600_000).toISOString().slice(0, 16) !== value) return;
  return date.toISOString();
}

export function mileageLabel(value: number | null): string {
  return value === null ? "Not listed" : `${value.toLocaleString("en-NG")} km`;
}
