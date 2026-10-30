import { describe, expect, it } from "vitest";
import {
  jobActionAllowed,
  jobRevision,
  parseWorkforceJobCandidates,
  parseWorkforceJobDetail,
  reviewReason,
  technicalChange,
  validateJobReceipt,
} from "../../lib/admin/workforce-job-detail";
import { detailId, jobDetailData } from "../fixtures/workforce-job-detail-data";
describe("managed job detail boundaries", () => {
  it("rejects mismatched references and foreign branch/assignee projections", () => {
    expect(parseWorkforceJobDetail(jobDetailData()).assignedStaff?.firstName).toBe("Ada");
    for (const field of ["branch", "assignedStaff"] as const) {
      const job = jobDetailData();
      job[field]!.id = detailId(99);
      expect(() => parseWorkforceJobDetail(job)).toThrow();
    }
    const foreign = jobDetailData();
    foreign.branchId = detailId(99);
    foreign.branch!.id = detailId(99);
    expect(() => parseWorkforceJobDetail(foreign)).toThrow();
    const other = jobDetailData();
    other.assignedStaffId = detailId(99);
    other.assignedStaff!.id = detailId(99);
    expect(() => parseWorkforceJobDetail(other)).toThrow();
  });
  it("allows only supported work transitions and rejects empty or unchanged notes", () => {
    const job = jobDetailData(),
      values = {
        diagnosis: job.workOrder!.diagnosis!,
        internalNotes: job.workOrder!.internalNotes!,
        status: "",
      };
    expect(() => technicalChange(job, values)).toThrow(/Change a note/);
    expect(() => technicalChange(job, { ...values, diagnosis: " " })).toThrow(
      /cannot be cleared/,
    );
    expect(() => technicalChange(job, { ...values, status: "COMPLETED" })).toThrow();
    expect(
      technicalChange(job, {
        ...values,
        diagnosis: "  Updated finding  ",
        status: "AWAITING_PARTS",
      }),
    ).toEqual({
      kind: "work",
      body: {
        expectedVersion: 3,
        diagnosis: "Updated finding",
        status: "AWAITING_PARTS",
      },
    });
    job.workOrder!.status = "APPROVED";
    expect(() => technicalChange(job, { ...values, status: "QUALITY_CHECK" })).toThrow();
    expect(technicalChange(job, { ...values, status: "IN_PROGRESS" }).kind).toBe("work");
    job.status = "COMPLETED";
    expect(jobActionAllowed(job, "work")).toBe(false);
  });
  it("enforces lead scope and independent attributed quality review", () => {
    const job = jobDetailData(true);
    job.workOrder!.status = "QUALITY_CHECK";
    expect(jobActionAllowed(job, "quality")).toBe(true);
    job.workOrder!.workedByUserIds.push(job.access.userId);
    expect(jobActionAllowed(job, "quality")).toBe(false);
    job.workOrder!.workedByUserIds = [];
    expect(jobActionAllowed(job, "quality")).toBe(false);
    job.workOrder!.workedByUserIds = [detailId(11)];
    job.assignedStaffId = job.access.staffId;
    expect(jobActionAllowed(job, "quality")).toBe(false);
    expect(jobActionAllowed(job, "assignment")).toBe(true);
    job.status = "COMPLETED";
    expect(jobActionAllowed(job, "assignment")).toBe(false);
    expect(jobActionAllowed(jobDetailData(), "assignment")).toBe(false);
    expect(() => reviewReason("    short    ")).toThrow();
    expect(reviewReason("  Independently checked  ")).toBe("Independently checked");
  });
  it("validates technical receipts including booking transitions, exact fields and attribution", () => {
    const base = jobDetailData();
    base.status = "CONFIRMED";
    base.workOrder!.status = "APPROVED";
    const change = technicalChange(base, {
      diagnosis: "Updated diagnostic finding",
      internalNotes: base.workOrder!.internalNotes!,
      status: "IN_PROGRESS",
    });
    const result = structuredClone(base);
    result.version++;
    result.status = "IN_PROGRESS";
    result.workOrder!.version++;
    result.workOrder!.status = "IN_PROGRESS";
    result.workOrder!.diagnosis = "Updated diagnostic finding";
    expect(validateJobReceipt(base, result, change).status).toBe("IN_PROGRESS");
    const malformed = structuredClone(result);
    malformed.version--;
    expect(() => validateJobReceipt(base, malformed, change)).toThrow();
    malformed.version++;
    malformed.workOrder!.diagnosis = "Different finding";
    expect(() => validateJobReceipt(base, malformed, change)).toThrow();
    malformed.workOrder!.diagnosis = result.workOrder!.diagnosis;
    malformed.workOrder!.workedByUserIds = [];
    expect(() => validateJobReceipt(base, malformed, change)).toThrow();
  });
  it("validates quality completion and rejects a wrong reviewer or unchanged booking", () => {
    const base = jobDetailData(true);
    base.workOrder!.status = "QUALITY_CHECK";
    const change = {
      kind: "quality" as const,
      body: { expectedVersion: 3, reason: "Independent checks completed" },
    };
    const result = structuredClone(base);
    result.version++;
    result.status = "COMPLETED";
    result.workOrder!.version++;
    result.workOrder!.status = "COMPLETED";
    result.workOrder!.qualityApprovedByUserId = base.access.userId;
    result.workOrder!.qualityApprovedAt = "2026-10-19T10:00:00.000Z";
    expect(validateJobReceipt(base, result, change).status).toBe("COMPLETED");
    result.workOrder!.qualityApprovedByUserId = detailId(90);
    expect(() => validateJobReceipt(base, result, change)).toThrow();
    result.workOrder!.qualityApprovedByUserId = base.access.userId;
    result.status = "IN_PROGRESS";
    expect(() => validateJobReceipt(base, result, change)).toThrow();
  });
  it("checks assignment receipts without accepting unrelated work changes", () => {
    const base = jobDetailData(true),
      technician = { id: detailId(44), firstName: "Chidi", lastName: "Eze" };
    const change = {
      kind: "assignment" as const,
      technician,
      body: {
        expectedVersion: 2,
        staffId: technician.id,
        reason: "Rebalance workshop work",
      },
    };
    const result = structuredClone(base);
    result.version++;
    result.assignedStaffId = technician.id;
    result.assignedStaff = technician;
    expect(validateJobReceipt(base, result, change).assignedStaffId).toBe(technician.id);
    result.workOrder!.version++;
    expect(() => validateJobReceipt(base, result, change)).toThrow();
  });
  it("validates candidate scope and pagination while ignoring generation time in job revisions", () => {
    const job = jobDetailData(true),
      page = {
        items: [{ id: detailId(30), firstName: "Ada", lastName: "Okoro" }],
        access: job.access,
        jobId: job.id,
        jobVersion: job.version,
        branchId: job.branchId,
        generatedAt: job.generatedAt,
      };
    expect(parseWorkforceJobCandidates(page).items).toHaveLength(1);
    expect(() =>
      parseWorkforceJobCandidates({ ...page, nextCursor: detailId(30) }),
    ).toThrow();
    expect(() =>
      parseWorkforceJobCandidates({ ...page, items: [...page.items, ...page.items] }),
    ).toThrow();
    expect(() =>
      parseWorkforceJobCandidates({ ...page, branchId: detailId(60) }),
    ).toThrow();
    const next = structuredClone(job);
    next.generatedAt = "2026-10-20T08:00:00.000Z";
    expect(jobRevision(next)).toBe(jobRevision(job));
    next.workOrder!.internalNotes = "Changed after inspection";
    expect(jobRevision(next)).not.toBe(jobRevision(job));
  });
});

it("binds concern classification receipts to the reviewed service and original concern", () => {
  const base = jobDetailData(true);
  base.service = null;
  base.status = "REQUESTED";
  base.workOrder = null;
  base.customerConcern = "Engine rattles on start.";
  const service = { id: detailId(900), name: "Concern diagnostics" },
    technician = base.assignedStaff!;
  const change = {
    kind: "assignment" as const,
    technician,
    service,
    body: {
      expectedVersion: base.version,
      staffId: technician.id,
      serviceId: service.id,
      reason: "Concern reviewed for workshop assignment.",
    },
  };
  const after = { ...base, service, version: base.version + 1 };
  expect(validateJobReceipt(base, after, change).service).toEqual(service);
  expect(() =>
    validateJobReceipt(base, { ...after, customerConcern: "Changed" }, change),
  ).toThrow();
  expect(() =>
    validateJobReceipt(
      base,
      { ...after, service: { ...service, id: detailId(901) } },
      change,
    ),
  ).toThrow();
  expect(() =>
    validateJobReceipt(base, { ...after, status: "CONFIRMED" }, change),
  ).toThrow();
});
