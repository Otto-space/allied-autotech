import { z } from "zod";
import { workforceAccessSchema, workforceJobSchema } from "../api/workforce-schemas";
import { parseScopedWorkforceJobs } from "./workforce-jobs";
import { sameWorkforceScope } from "./workforce-overview";
import { workforceActionPredicates, workforceAllows } from "../workforce-registry";

const person = z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() });
const detailSchema = workforceJobSchema.extend({
  generatedAt: z.iso.datetime(),
  access: workforceAccessSchema.safeExtend({ managed: z.literal(true) }),
  branch: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  assignedStaff: person.nullable(),
});
export type WorkforceJobDetail = z.infer<typeof detailSchema>;
export function parseWorkforceJobDetail(value: unknown) {
  const job = detailSchema.parse(value);
  parseScopedWorkforceJobs({
    items: [job],
    access: job.access,
    generatedAt: job.generatedAt,
  });
  if (
    job.branchId !== (job.branch?.id ?? null) ||
    job.assignedStaffId !== (job.assignedStaff?.id ?? null) ||
    job.version < 0 ||
    (job.workOrder && job.workOrder.version < 0)
  )
    throw Error("Job references do not match the current record");
  return job;
}
export const parseWorkforceJobCandidates = (value: unknown) => {
  const data = z
    .object({
      items: z.array(person).max(25),
      nextCursor: z.uuid().optional(),
      jobId: z.uuid(),
      jobVersion: z.number().int().min(0),
      branchId: z.uuid(),
      generatedAt: z.iso.datetime(),
      access: workforceAccessSchema.safeExtend({ managed: z.literal(true) }),
    })
    .parse(value);
  if (
    !data.access.permissions.includes("JOBS_ASSIGN") ||
    !data.access.assignments.some(
      (a) =>
        a.userId === data.access.userId &&
        a.branchId === data.branchId &&
        a.template === "WORKSHOP_LEAD" &&
        a.scope === "BRANCH",
    ) ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    (data.nextCursor &&
      (data.items.length !== 25 || data.nextCursor !== data.items.at(-1)?.id))
  )
    throw Error("Technician options do not match current access");
  return data;
};
export type WorkforceJobCandidate = z.infer<typeof person>;
export const technicianName = (person: WorkforceJobCandidate) =>
  `${person.firstName} ${person.lastName}`.trim();
export const bookingStateLabels: Record<string, string> = {
  REQUESTED: "Requested",
  AWAITING_DEPOSIT: "Awaiting deposit",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No show",
  EXPIRED: "Expired",
};
export const workTransitions: Record<string, readonly string[]> = {
  APPROVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["AWAITING_PARTS", "QUALITY_CHECK"],
  AWAITING_PARTS: ["IN_PROGRESS"],
};
export function jobActionAllowed(
  job: WorkforceJobDetail,
  action: "work" | "quality" | "assignment",
) {
  const access = job.access,
    work = job.workOrder;
  if (action === "work")
    return (
      workforceAllows(access, workforceActionPredicates.jobWork, job) &&
      !!work &&
      ["CONFIRMED", "IN_PROGRESS"].includes(job.status) &&
      Object.hasOwn(workTransitions, work.status)
    );
  const lead = access.assignments.some(
    (a) =>
      a.userId === access.userId &&
      a.branchId === job.branchId &&
      a.template === "WORKSHOP_LEAD" &&
      a.scope === "BRANCH",
  );
  if (!lead) return false;
  if (action === "assignment")
    return (
      workforceAllows(access, workforceActionPredicates.jobAssign, job) &&
      ["REQUESTED", "AWAITING_DEPOSIT", "CONFIRMED", "IN_PROGRESS"].includes(job.status)
    );
  return (
    workforceAllows(access, workforceActionPredicates.jobQuality, job) &&
    job.status === "IN_PROGRESS" &&
    work?.status === "QUALITY_CHECK" &&
    work.workedByUserIds.length > 0 &&
    !work.workedByUserIds.includes(access.userId) &&
    job.assignedStaffId !== access.staffId
  );
}
export type WorkforceJobChange =
  | {
      kind: "work";
      body: {
        expectedVersion: number;
        diagnosis?: string;
        internalNotes?: string;
        status?: "IN_PROGRESS" | "AWAITING_PARTS" | "QUALITY_CHECK";
      };
    }
  | { kind: "quality"; body: { expectedVersion: number; reason: string } }
  | {
      kind: "assignment";
      body: {
        expectedVersion: number;
        staffId: string;
        reason: string;
        serviceId?: string;
      };
      service?: { id: string; name: string };
      technician: WorkforceJobCandidate;
    };
export class JobFieldError extends Error {
  constructor(
    message: string,
    public readonly field:
      "diagnosis" | "internalNotes" | "status" | "findings" | "reason",
  ) {
    super(message);
  }
}
export function technicalChange(
  job: WorkforceJobDetail,
  values: { diagnosis: string; internalNotes: string; status: string },
): WorkforceJobChange {
  if (!jobActionAllowed(job, "work") || !job.workOrder)
    throw Error("Technical work is unavailable for this job.");
  const body: Extract<WorkforceJobChange, { kind: "work" }>["body"] = {
    expectedVersion: job.workOrder.version,
  };
  for (const field of ["diagnosis", "internalNotes"] as const) {
    const value = values[field].trim(),
      previous = job.workOrder[field] ?? "";
    if (value === previous) continue;
    if (!value)
      throw new JobFieldError(
        `${field === "diagnosis" ? "Diagnosis" : "Work notes"} cannot be cleared. Enter replacement text.`,
        field,
      );
    if (value.length > 5000)
      throw new JobFieldError(
        "Each technical note must contain at most 5,000 characters.",
        field,
      );
    body[field] = value;
  }
  if (values.status) {
    if (!workTransitions[job.workOrder.status]?.includes(values.status))
      throw new JobFieldError("This progress change is unavailable.", "status");
    body.status = values.status as NonNullable<typeof body.status>;
  }
  if (Object.keys(body).length === 1)
    throw Error("Change a note or select a new progress state before reviewing.");
  return { kind: "work", body };
}
export function reviewReason(value: string, field: "reason" | "findings" = "reason") {
  const reason = value.trim();
  if (reason.length < 10 || reason.length > 1000)
    throw new JobFieldError("Enter a reason containing 10–1,000 characters.", field);
  return reason;
}
export function jobRevision(job: WorkforceJobDetail) {
  const { generatedAt: _generatedAt, access: _access, ...record } = job;
  void _generatedAt;
  void _access;
  return JSON.stringify(record);
}
export function validateJobReceipt(
  base: WorkforceJobDetail,
  result: unknown,
  change: WorkforceJobChange,
) {
  base = parseWorkforceJobDetail(base);
  const after = parseWorkforceJobDetail(result),
    work = base.workOrder,
    next = after.workOrder;
  const fail = () => {
    throw Error("The recorded job change could not be verified.");
  };
  if (
    after.id !== base.id ||
    !sameWorkforceScope(base.access, after.access) ||
    after.branchId !== base.branchId ||
    after.scheduledAt !== base.scheduledAt ||
    after.customerNotes !== base.customerNotes ||
    after.customerConcern !== base.customerConcern ||
    (!(change.kind === "assignment" && change.service) &&
      JSON.stringify(after.service) !== JSON.stringify(base.service)) ||
    JSON.stringify(after.vehicle) !== JSON.stringify(base.vehicle)
  )
    fail();
  if (change.kind === "assignment") {
    if (
      change.service &&
      (base.service !== null ||
        base.status !== "REQUESTED" ||
        change.body.serviceId !== change.service.id ||
        after.service?.id !== change.service.id ||
        after.service?.name !== change.service.name)
    )
      fail();
    if (
      after.version !== base.version + 1 ||
      after.status !== base.status ||
      after.assignedStaffId !== change.body.staffId ||
      JSON.stringify(after.assignedStaff) !== JSON.stringify(change.technician) ||
      JSON.stringify(next) !== JSON.stringify(work)
    )
      fail();
    return after;
  }
  if (!work || !next) return fail();
  if (
    next.id !== work.id ||
    next.workOrderNumber !== work.workOrderNumber ||
    next.version !== work.version + 1 ||
    after.assignedStaffId !== base.assignedStaffId
  )
    fail();
  if (change.kind === "quality") {
    if (
      after.version !== base.version + 1 ||
      after.status !== "COMPLETED" ||
      next.status !== "COMPLETED" ||
      next.qualityApprovedByUserId !== base.access.userId ||
      !next.qualityApprovedAt ||
      next.diagnosis !== work.diagnosis ||
      next.internalNotes !== work.internalNotes ||
      JSON.stringify(next.workedByUserIds) !== JSON.stringify(work.workedByUserIds)
    )
      fail();
  } else {
    const started = change.body.status === "IN_PROGRESS" && base.status === "CONFIRMED";
    if (
      after.version !== base.version + (started ? 1 : 0) ||
      after.status !== (started ? "IN_PROGRESS" : base.status) ||
      next.status !== (change.body.status ?? work.status) ||
      next.diagnosis !== (change.body.diagnosis ?? work.diagnosis) ||
      next.internalNotes !== (change.body.internalNotes ?? work.internalNotes) ||
      next.qualityApprovedAt !== work.qualityApprovedAt ||
      next.qualityApprovedByUserId !== work.qualityApprovedByUserId ||
      JSON.stringify([...next.workedByUserIds].sort()) !==
        JSON.stringify([...new Set([...work.workedByUserIds, base.access.userId])].sort())
    )
      fail();
  }
  return after;
}
