import { z } from "zod";
import { workforceAccessSchema } from "../api/workforce-schemas";
export { inspectionPageParams as workforceBookingsPageParams } from "./work-inspections";
export const bookingStatusLabels = {
  REQUESTED: "Requested",
  AWAITING_DEPOSIT: "Awaiting deposit",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  EXPIRED: "Expired",
} as const;
const workforceBookingSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  scheduledAt: z.iso.datetime(),
  status: z.enum(
    Object.keys(bookingStatusLabels) as [
      keyof typeof bookingStatusLabels,
      ...Array<keyof typeof bookingStatusLabels>,
    ],
  ),
  version: z.number().int().nonnegative(),
  service: z.object({ name: z.string() }),
  customer: z.object({ firstName: z.string(), lastName: z.string(), phone: z.string() }),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().int().nullable(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
});
export function workforceBookingsQuery(input: URLSearchParams) {
  const allowed = ["q", "status", "cursor", "_trail"],
    params = new URLSearchParams();
  let invalid = [...input.keys()].some(
    (key) => !allowed.includes(key) || input.getAll(key).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    status = input.get("status") ?? "",
    cursor = input.get("cursor"),
    trail = input.get("_trail");
  if (
    q.length > 120 ||
    [...q].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    (status && !Object.hasOwn(bookingStatusLabels, status))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (cursor !== null) {
    if (!z.uuid().safeParse(cursor).success) invalid = true;
    else params.set("cursor", cursor);
  }
  if (trail !== null) {
    const entries = trail.split(",");
    if (
      !cursor ||
      entries.length > 50 ||
      entries[0] !== "start" ||
      entries.slice(1).some((value) => !z.uuid().safeParse(value).success) ||
      entries.includes(cursor) ||
      new Set(entries).size !== entries.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/staff/workforce/bookings?${api}` };
}
export const bookingsHref = (params: URLSearchParams) =>
  `/admin/workforce/bookings${params.size ? `?${params}` : ""}`;
export function parseScopedWorkforceBookings(value: unknown) {
  const data = z
    .object({
      items: z.array(workforceBookingSchema).max(25),
      nextCursor: z.uuid().optional(),
      generatedAt: z.iso.datetime(),
      access: workforceAccessSchema.safeExtend({ managed: z.literal(true) }),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("BOOKINGS_READ") ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.items.length !== 25 || data.nextCursor !== data.items.at(-1)?.id)) ||
    data.items.some(
      (booking) =>
        booking.branch?.id !== booking.branchId ||
        !data.access.assignments.some(
          (assignment) =>
            ["OPERATIONS", "CUSTOMER_SERVICE"].includes(assignment.template) &&
            assignment.userId === data.access.userId &&
            assignment.branchId === booking.branchId &&
            assignment.scope === "BRANCH" &&
            assignment.revokedAt === null &&
            Date.parse(assignment.startsAt) <= Date.parse(data.access.serverTime) &&
            (assignment.expiresAt === null ||
              Date.parse(assignment.expiresAt) > Date.parse(data.access.serverTime)),
        ),
    )
  )
    throw Error("Bookings do not match current responsibility scope");
  return data;
}
