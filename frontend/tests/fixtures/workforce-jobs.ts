import type { Page } from "@playwright/test";
import { workforceNotificationsFixture } from "./workforce-notifications";
const id = (n: number) => `b6000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function workforceJobsFixture(page: Page, lead = false) {
  const base = await workforceNotificationsFixture(
    page,
    lead ? "WORKSHOP_LEAD" : "ELECTRICAL_TECHNICIAN",
  );
  const statuses = [
    "IN_PROGRESS",
    "AWAITING_PARTS",
    "QUALITY_CHECK",
    "APPROVED",
    "COMPLETED",
    "DRAFT",
    "CANCELLED",
  ];
  const jobs = Array.from({ length: 27 }, (_, index) => ({
    id: id(index + 1),
    branchId: base.access.assignments[0].branchId,
    scheduledAt: new Date(Date.UTC(2026, 9, 19, 8 + index)).toISOString(),
    status: index === 4 ? "COMPLETED" : "CONFIRMED",
    version: 0,
    assignedStaffId: base.access.staffId,
    customerNotes: "Synthetic customer note",
    customerConcern: null as string | null,
    service: { name: index % 2 ? "Preventive maintenance" : "Engine diagnostics" } as {
      name: string;
    } | null,
    vehicle:
      index === 3
        ? null
        : {
            make: index % 2 ? "Honda" : "Toyota",
            model: index % 2 ? "Accord" : "Corolla",
            year: 2020,
            registrationNumber: `PHC-${101 + index}-AA`,
          },
    workOrder:
      index === 3
        ? null
        : {
            id: id(index + 101),
            workOrderNumber: `WO-2026-${String(124 + index).padStart(4, "0")}`,
            status: statuses[index % statuses.length],
            diagnosis: null,
            internalNotes: null,
            version: 0,
            workedByUserIds: [],
            qualityApprovedByUserId: null,
            qualityApprovedAt: null,
          },
  }));
  const state = {
    ...base,
    jobs,
    reads: [] as string[],
    fail: false,
    deniedJobs: false,
    holdJobs: false,
    releaseJobs: undefined as (() => void) | undefined,
    malformed: false,
    responseAccess: base.access,
  };
  await page.route("**/api/v1/staff/workforce/jobs**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/assignees")) {
      const job = state.jobs.find(
        (item) => url.pathname === `/api/v1/staff/workforce/jobs/${item.id}/assignees`,
      );
      if (!job) throw Error("Unknown synthetic job");
      return route.fulfill({
        json: {
          success: true,
          data: {
            items: [],
            access: state.access,
            generatedAt: new Date().toISOString(),
            jobId: job.id,
            jobVersion: job.version,
            branchId: job.branchId,
          },
          message: "No synthetic technicians configured",
          meta: { requestId: "concern-job-assignees" },
        },
      });
    }
    if (url.pathname !== "/api/v1/staff/workforce/jobs") {
      const job = state.jobs.find(
        (item) => url.pathname === `/api/v1/staff/workforce/jobs/${item.id}`,
      );
      if (job)
        return route.fulfill({
          json: {
            success: true,
            message: "Synthetic job",
            meta: { requestId: "workforce-jobs-detail" },
            data: {
              ...job,
              access: state.access,
              generatedAt: "2026-10-19T09:40:00.000Z",
              branch: { id: job.branchId, name: "Stadium Road" },
              assignedStaff: job.assignedStaffId
                ? { id: job.assignedStaffId, firstName: "Ada", lastName: "Okoro" }
                : null,
            },
          },
        });
      return route.fallback();
    }
    state.reads.push(url.search);
    if (state.holdJobs)
      await new Promise<void>((resolve) => {
        state.releaseJobs = resolve;
      });
    if (state.fail || state.deniedJobs)
      return route.fulfill({
        status: state.deniedJobs ? 403 : 503,
        json: {
          success: false,
          message: "Synthetic jobs unavailable",
          error: { code: state.deniedJobs ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" },
        },
      });
    const q = (url.searchParams.get("q") ?? "").toLowerCase(),
      status = url.searchParams.get("workStatus"),
      cursor = url.searchParams.get("cursor");
    const filtered = state.jobs.filter(
      (job) =>
        (!q ||
          JSON.stringify([
            job.service?.name,
            job.customerConcern,
            job.vehicle,
            job.workOrder?.workOrderNumber,
          ])
            .toLowerCase()
            .includes(q)) &&
        (!status ||
          (status === "NOT_CREATED"
            ? !job.workOrder
            : job.workOrder?.status === status)) &&
        (!cursor || job.id > cursor),
    );
    const limit = Number(url.searchParams.get("limit") ?? 25),
      items = filtered.slice(0, limit);
    return route.fulfill({
      json: {
        success: true,
        message: "Synthetic permitted jobs",
        meta: { requestId: "workforce-jobs" },
        data: {
          items: state.malformed ? [{ id: "invalid" }] : items,
          ...(filtered.length > limit ? { nextCursor: items.at(-1)!.id } : {}),
          access: state.responseAccess,
          generatedAt: "2026-10-19T09:40:00.000Z",
        },
      },
    });
  });
  return state;
}
