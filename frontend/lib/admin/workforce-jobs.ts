import { z } from "zod";
import { workforceAccessSchema, workforceJobSchema } from "../api/workforce-schemas";
export { inspectionPageParams as workforceJobsPageParams } from "./work-inspections";
export const workStatusLabels = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  IN_PROGRESS: "In progress",
  AWAITING_PARTS: "Awaiting parts",
  QUALITY_CHECK: "Quality check",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NOT_CREATED: "Not created",
} as const;
export function workforceJobsQuery(input: URLSearchParams) {
  const allowed = ["q", "workStatus", "cursor", "_trail"],
    params = new URLSearchParams();
  let invalid = [...input.keys()].some(
    (key) => !allowed.includes(key) || input.getAll(key).length !== 1,
  );
  const q = (input.get("q") ?? "").trim(),
    status = input.get("workStatus") ?? "",
    cursor = input.get("cursor"),
    trail = input.get("_trail");
  if (
    q.length > 120 ||
    [...q].some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) ||
    (status && !Object.hasOwn(workStatusLabels, status))
  )
    invalid = true;
  if (q) params.set("q", q);
  if (status) params.set("workStatus", status);
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
  return { params, invalid, path: invalid ? null : `/staff/workforce/jobs?${api}` };
}
export const jobsHref = (params: URLSearchParams) =>
  `/admin/workforce/jobs${params.size ? `?${params}` : ""}`;
export function parseScopedWorkforceJobs(value: unknown) {
  const data = z
    .object({
      items: z.array(workforceJobSchema).max(25),
      nextCursor: z.uuid().optional(),
      generatedAt: z.iso.datetime(),
      access: workforceAccessSchema.extend({ managed: z.literal(true) }),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("JOBS_READ") ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.items.length !== 25 || data.nextCursor !== data.items.at(-1)?.id)) ||
    data.items.some(
      (job) =>
        !data.access.assignments.some(
          (assignment) =>
            ["WORKSHOP_LEAD", "ELECTRICAL_TECHNICIAN", "MECHANICAL_TECHNICIAN"].includes(
              assignment.template,
            ) &&
            assignment.userId === data.access.userId &&
            assignment.branchId === job.branchId &&
            (assignment.scope === "BRANCH" ||
              (data.access.staffId !== null &&
                job.assignedStaffId === data.access.staffId)),
        ),
    )
  )
    throw Error("Jobs do not match current responsibility scope");
  return data;
}
