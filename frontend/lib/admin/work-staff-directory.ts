import { z } from "zod";
import {
  privilegedRoles,
  staffStatuses,
  staffMemberSchema,
  type StaffMember,
} from "@/lib/api/staff-admin-schemas";
import { inspectionPageParams } from "./work-inspections";
const uuid = z.uuid();
export const staffLabels = {
  STAFF: "Staff",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  DEACTIVATED: "Deactivated",
};
export function staffDirectoryQuery(input: URLSearchParams) {
  const params = new URLSearchParams();
  let invalid = false;
  for (const k of input.keys())
    if (
      !["q", "role", "status", "branchId", "cursor", "_trail"].includes(k) ||
      input.getAll(k).length !== 1
    )
      invalid = true;
  for (const k of ["q", "role", "status", "branchId", "cursor"]) {
    const v = input.get(k);
    if (v === null) continue;
    const value = k === "q" ? v.trim() : v;
    const valid =
      k === "q"
        ? value.length >= 2 &&
          value.length <= 100 &&
          !/[\u0000-\u001f\u007f]/u.test(value)
        : k === "role"
          ? (privilegedRoles as readonly string[]).includes(value)
          : k === "status"
            ? (staffStatuses as readonly string[]).includes(value)
            : uuid.safeParse(value).success;
    if (!valid) invalid = true;
    else params.set(k, ["branchId", "cursor"].includes(k) ? value.toLowerCase() : value);
  }
  const trail = input.get("_trail");
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !params.has("cursor") ||
      parts[0] !== "start" ||
      parts.length > 50 ||
      parts.slice(1).some((v) => !uuid.safeParse(v).success) ||
      new Set(parts).size !== parts.length ||
      parts.includes(params.get("cursor")!)
    )
      invalid = true;
    else params.set("_trail", trail.toLowerCase());
  }
  const api = new URLSearchParams(params);
  api.delete("_trail");
  api.set("limit", "25");
  return { params, invalid, path: invalid ? null : `/admin/staff?${api}` };
}
export const staffDirectoryPageParams = inspectionPageParams;
export const directoryName = (r: StaffMember) =>
  r.staffProfile
    ? `${r.staffProfile.firstName} ${r.staffProfile.lastName}`.trim() || r.email
    : r.email;
export function parseStaffDirectory(value: unknown, query: URLSearchParams) {
  const profile = staffMemberSchema.shape.staffProfile.unwrap();
  const row = staffMemberSchema
    .extend({
      staffProfile: profile
        .extend({ branch: profile.shape.branch.unwrap().strict().nullable() })
        .strict()
        .nullable(),
    })
    .strict();
  const page = z
    .object({ items: z.array(row).max(25), nextCursor: uuid.optional() })
    .strict()
    .parse(value);
  if (
    new Set(page.items.map((v) => v.id)).size !== page.items.length ||
    (page.nextCursor &&
      (page.nextCursor !== page.items.at(-1)?.id ||
        page.nextCursor === query.get("cursor"))) ||
    page.items.some(
      (v, i) =>
        (i > 0 && page.items[i - 1]!.id.localeCompare(v.id) >= 0) ||
        (query.has("cursor") && v.id <= query.get("cursor")!) ||
        (query.has("role") && v.role !== query.get("role")) ||
        (query.has("status") && v.status !== query.get("status")) ||
        (query.has("branchId") && v.staffProfile?.branchId !== query.get("branchId")) ||
        (v.staffProfile &&
          ((v.staffProfile.branchId === null) !== (v.staffProfile.branch === null) ||
            (v.staffProfile.branch?.id !== v.staffProfile.branchId &&
              v.staffProfile.branchId !== null))),
    )
  )
    throw Error("Staff directory scope could not be confirmed");
  return page;
}
