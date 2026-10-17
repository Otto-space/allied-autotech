import { lagosDateBoundary } from "./work-booking-query";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function workSlotQuery(input: URLSearchParams, admin = true) {
  const params = new URLSearchParams();
  const api = new URLSearchParams({ limit: "25" });
  let invalid = false;
  for (const key of [
    "status",
    "from",
    "to",
    "branchId",
    "serviceId",
    "staffId",
    "cursor",
    "_trail",
  ])
    if (input.getAll(key).length > 1) invalid = true;
  const status = input.get("status");
  if (status) {
    if (status === "OPEN" || status === "CLOSED") {
      params.set("status", status);
      api.set("status", status);
    } else invalid = true;
  }
  for (const key of ["branchId", "serviceId", "staffId", "cursor"]) {
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
  const start = from ? lagosDateBoundary(from) : null,
    end = to ? lagosDateBoundary(to) : null;
  if (
    (from && start === null) ||
    (to && end === null) ||
    (start !== null && end !== null && end < start)
  )
    invalid = true;
  if (start !== null) {
    params.set("from", from);
    api.set("startsFrom", new Date(start).toISOString());
  }
  if (end !== null) {
    params.set("to", to);
    api.set("startsTo", new Date(end + 86_400_000).toISOString());
  }
  const trail = input.get("_trail")?.split(",") ?? [];
  if (
    params.has("cursor") &&
    trail.length &&
    trail.length <= 50 &&
    trail[0] === "start" &&
    trail.slice(1).every((value) => uuid.test(value))
  )
    params.set("_trail", trail.join(","));
  return { params, api, invalid, path: invalid ? null : `/staff/booking-slots?${api}` };
}
