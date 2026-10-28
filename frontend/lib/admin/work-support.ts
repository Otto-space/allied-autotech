import { z } from "zod";
import { ApiError } from "../api/client";
import {
  enquiryTypes,
  parseSupportPage,
  priorities,
  supportStatuses,
  type SupportKind,
} from "../api/support-schemas";
import { inspectionPageParams } from "./work-inspections";
export function workSupportQuery(
  input: URLSearchParams,
  role: string,
  branchId?: string | null,
) {
  let invalid = false;
  const params = new URLSearchParams(),
    kind = input.get("kind") ?? "enquiries";
  for (const key of input.keys())
    if (
      ![
        "kind",
        "q",
        "status",
        "type",
        "priority",
        "branchId",
        "assignedStaffId",
        "cursor",
        "_trail",
      ].includes(key) ||
      input.getAll(key).length !== 1
    )
      invalid = true;
  if (kind !== "enquiries" && kind !== "complaints") invalid = true;
  else if (kind !== "enquiries") params.set("kind", kind);
  const category: SupportKind = kind === "complaints" ? "complaints" : "enquiries";
  const q = input.get("q")?.trim().replace(/\s+/g, " ") ?? "";
  if (q) {
    if (q.length < 2 || q.length > 120 || /[\u0000-\u001f\u007f]/.test(q)) invalid = true;
    else params.set("q", q);
  }
  for (const key of [
    "status",
    "type",
    "priority",
    "branchId",
    "assignedStaffId",
    "cursor",
  ]) {
    const value = input.get(key);
    if (value === null) continue;
    if (key === "cursor" && !value) invalid = true;
    if (!value) continue;
    if (
      key === "status"
        ? !(supportStatuses[category] as readonly string[]).includes(value)
        : key === "type"
          ? category !== "enquiries" ||
            !(enquiryTypes as readonly string[]).includes(value)
          : key === "priority"
            ? category !== "complaints" ||
              !(priorities as readonly string[]).includes(value)
            : !z.uuid().safeParse(value).success
    )
      invalid = true;
    else params.set(key, value);
  }
  if (
    (category === "enquiries" && input.has("priority")) ||
    (category === "complaints" && input.has("type"))
  )
    invalid = true;
  if (
    role === "STAFF" &&
    (!branchId || (params.has("branchId") && params.get("branchId") !== branchId))
  )
    invalid = true;
  const trail = input.get("_trail"),
    cursor = params.get("cursor");
  if (trail !== null) {
    const parts = trail.split(",");
    if (
      !cursor ||
      parts.length > 50 ||
      parts[0] !== "start" ||
      parts.slice(1).some((s) => !z.uuid().safeParse(s).success) ||
      parts.includes(cursor) ||
      new Set(parts).size !== parts.length
    )
      invalid = true;
    else params.set("_trail", trail);
  }
  const api = new URLSearchParams(params);
  api.delete("kind");
  api.delete("_trail");
  api.set("limit", "25");
  return {
    params,
    kind: category,
    invalid,
    path: invalid ? null : `/staff/support/${category}?${api}`,
  };
}
export function parseWorkSupport(
  value: unknown,
  kind: SupportKind,
  role: string,
  branchId?: string | null,
  params = new URLSearchParams(),
) {
  const data = parseSupportPage(kind, true, value);
  if (
    data.items.length > 25 ||
    new Set(data.items.map((r) => r.id)).size !== data.items.length ||
    data.nextCursor === params.get("cursor")
  )
    throw Error("Unexpected support page");
  for (const r of data.items) {
    if (role === "STAFF" && (!branchId || r.branchId !== branchId))
      throw new ApiError(403, { error: { code: "FORBIDDEN" } });
    if (
      r.branchId !== (r.branch?.id ?? null) ||
      r.assignedStaffId !== (r.assignedStaff?.id ?? null) ||
      (params.has("branchId") && r.branchId !== params.get("branchId")) ||
      (params.has("assignedStaffId") &&
        r.assignedStaffId !== params.get("assignedStaffId")) ||
      (params.has("status") && r.status !== params.get("status")) ||
      (params.has("type") && (r.kind !== "enquiries" || r.type !== params.get("type"))) ||
      (params.has("priority") &&
        (r.kind !== "complaints" || r.priority !== params.get("priority")))
    )
      throw Error("Unexpected support scope");
  }
  return data;
}
export const supportPageParams = inspectionPageParams;
export function supportLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase().replaceAll("_", " ");
}
