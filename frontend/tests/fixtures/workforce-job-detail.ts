import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
import { detailId, jobDetailData } from "./workforce-job-detail-data";
import type { WorkforceAccess } from "../../lib/api/workforce-schemas";
export async function workforceJobDetailFixture(page: Page, lead = false) {
  const base = await workforceNotificationsFixture(
    page,
    lead ? "WORKSHOP_LEAD" : "ELECTRICAL_TECHNICIAN",
  );
  const job = jobDetailData(lead);
  job.access = base.access;
  job.branchId = base.access.assignments[0].branchId;
  job.branch!.id = job.branchId;
  if (!lead) {
    job.assignedStaffId = base.access.staffId;
    job.assignedStaff!.id = base.access.staffId!;
    job.workOrder!.workedByUserIds = [base.access.userId];
  }
  const candidates = Array.from({ length: 27 }, (_, index) => ({
    id: detailId(100 + index),
    firstName: index === 26 ? "Zara" : `Technician ${String(index + 1).padStart(2, "0")}`,
    lastName: index === 26 ? "Okafor" : "Test",
  }));
  const state = {
    base,
    job,
    candidates,
    writes: [] as { kind: string; body: Record<string, unknown> }[],
    reads: [] as string[],
    fail: false,
    denied: false,
    candidatesFail: false,
    hold: false,
    release: undefined as (() => void) | undefined,
    reject: false,
    loseResponse: false,
    malformed: false,
    detailAccess: undefined as WorkforceAccess | undefined,
  };
  await page.route("**/api/v1/staff/workforce/jobs/**", async (route) => {
    const url = new URL(route.request().url()),
      path = url.pathname,
      kind = path.split("/").at(-1)!;
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          message: "Synthetic job detail",
          meta: { requestId: "workforce-job-detail" },
          data,
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        json: {
          success: false,
          error: {
            code:
              status === 403
                ? "FORBIDDEN"
                : status === 409
                  ? "CONFLICT"
                  : "SERVICE_UNAVAILABLE",
          },
        },
      });
    const result = () => ({ ...state.job, access: state.detailAccess ?? base.access });
    if (route.request().method() === "GET") {
      state.reads.push(path + url.search);
      if (kind === "assignees") {
        if (state.candidatesFail) return fail(503);
        const q = (url.searchParams.get("q") ?? "").toLowerCase(),
          cursor = url.searchParams.get("cursor");
        const all = state.candidates.filter(
          (item) =>
            (!q || `${item.firstName} ${item.lastName}`.toLowerCase().includes(q)) &&
            (!cursor || item.id > cursor),
        );
        const items = all.slice(0, 25);
        return ok({
          items,
          ...(all.length > 25 ? { nextCursor: items.at(-1)!.id } : {}),
          access: base.access,
          jobId: state.job.id,
          jobVersion: state.job.version,
          branchId: state.job.branchId,
          generatedAt: state.job.generatedAt,
        });
      }
      if (state.hold)
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.denied || state.fail) return fail(state.denied ? 403 : 503);
      return ok(result());
    }
    const body = route.request().postDataJSON();
    state.writes.push({ kind, body });
    if (state.reject) return fail(409);
    if (kind === "work") {
      const work = state.job.workOrder!;
      if (body.expectedVersion !== work.version) return fail(409);
      if (body.diagnosis !== undefined) work.diagnosis = body.diagnosis;
      if (body.internalNotes !== undefined) work.internalNotes = body.internalNotes;
      if (body.status) work.status = body.status;
      work.version++;
      work.workedByUserIds = [...new Set([...work.workedByUserIds, base.access.userId])];
      if (body.status === "IN_PROGRESS" && state.job.status === "CONFIRMED") {
        state.job.status = "IN_PROGRESS";
        state.job.version++;
      }
    } else if (kind === "quality") {
      const work = state.job.workOrder!;
      if (body.expectedVersion !== work.version) return fail(409);
      work.status = "COMPLETED";
      work.version++;
      work.qualityApprovedByUserId = base.access.userId;
      work.qualityApprovedAt = new Date().toISOString();
      state.job.status = "COMPLETED";
      state.job.version++;
    } else if (kind === "assignment") {
      const target = state.candidates.find((item) => item.id === body.staffId);
      if (!target || body.expectedVersion !== state.job.version) return fail(409);
      state.job.assignedStaffId = target.id;
      state.job.assignedStaff = target;
      state.job.version++;
    } else return fail(403);
    if (state.loseResponse) return fail(503);
    if (state.malformed) return ok({ ...result(), version: -1 });
    return ok(result());
  });
  return state;
}
