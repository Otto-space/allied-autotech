import { bookingStatuses } from "./customer-booking-query";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const day = 86_400_000;
export function lagosDateBoundary(value: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value) || value.startsWith("9999")) return null;
  const utc = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value)
    return null;
  return utc - 3_600_000;
}
export function workBookingQuery(input: URLSearchParams, admin = true) {
  const params = new URLSearchParams();
  const api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of [
    "status",
    "from",
    "to",
    "branchId",
    "assignedStaffId",
    "cursor",
    "_trail",
  ]) {
    if (input.getAll(key).length > 1) invalid = true;
  }
  const status = input.get("status");
  if (status) {
    if (bookingStatuses.some((value) => value === status)) {
      params.set("status", status);
      api.set("status", status);
    } else invalid = true;
  }
  for (const key of ["branchId", "assignedStaffId", "cursor"]) {
    const value = input.get(key);
    if (!value) continue;
    if (!uuid.test(value) || (!admin && key === "branchId")) invalid = true;
    else {
      params.set(key, value);
      api.set(key, value);
    }
  }
  const from = input.get("from") ?? "",
    to = input.get("to") ?? "";
  const start = from ? lagosDateBoundary(from) : null;
  const end = to ? lagosDateBoundary(to) : null;
  if ((from && start === null) || (to && end === null)) invalid = true;
  if (start !== null) {
    params.set("from", from);
    api.set("scheduledFrom", new Date(start).toISOString());
  }
  if (end !== null) {
    params.set("to", to);
    api.set("scheduledTo", new Date(end + day).toISOString());
  }
  if (start !== null && end !== null && (end < start || end + day - start > 366 * day))
    invalid = true;
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((value) => uuid.test(value))
  )
    params.set("_trail", trail.join(","));
  return { params, api, invalid, path: invalid ? null : `/staff/bookings?${api}` };
}
