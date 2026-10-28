import type { Page } from "@playwright/test";
import { workforceEnquiriesFixture } from "./workforce-enquiries";
import { workforceComplaintsFixture } from "./workforce-complaints";
import { aftercareSnapshot, aftercareId as id } from "./workforce-aftercare-data";
import { definitionForAssignment } from "../../../backend/src/modules/organization/workforce-catalogue";

export async function careCasesFixture(
  page: Page,
  kind: "enquiries" | "complaints",
  duties: ("CARE_VIEWER" | "CARE_RESPONDER" | "CARE_ASSIGNER" | "CARE_LIVE_AGENT")[],
  role: "STAFF" | "ADMIN" = "STAFF",
) {
  const f =
    kind === "enquiries"
      ? await workforceEnquiriesFixture(page, "CUSTOMER_SERVICE", role)
      : await workforceComplaintsFixture(page, role);
  const original = f.base.access.assignments[0],
    row = f.items[0];
  f.base.access.position = "CUSTOMER_SERVICE";
  f.base.access.assignments = duties.map((template, i) => ({
    ...original,
    id: id(3000 + i),
    template,
    templateVersion: 2,
    scope: "BRANCH",
  }));
  function snapshot() {
    f.base.access.permissions = [
      ...new Set(
        f.base.access.assignments.flatMap((a) => [
          ...(definitionForAssignment({ ...a, templateVersion: a.templateVersion ?? 1 })
            ?.actions ?? []),
        ]),
      ),
    ];
    Object.assign(f.base.access, aftercareSnapshot(f.base.access, role));
  }
  snapshot();
  Object.assign(row, {
    contact: {
      name: "Fixture customer",
      email: "fixture-care@example.test",
      phone: null,
      customerId: null,
    },
    subject:
      kind === "enquiries"
        ? "Fixture: General vehicle question"
        : "Fixture: Service follow-up",
    ...(kind === "enquiries" ? { type: "GENERAL" } : {}),
    assignedStaffId: f.base.access.staffId,
    assignedStaff: { id: f.base.access.staffId, firstName: "Ada", lastName: "Okoro" },
  });
  if (kind === "complaints")
    for (const item of f.items)
      Object.assign(item, {
        assignedStaffId: f.base.access.staffId,
        assignedStaff: { id: f.base.access.staffId, firstName: "Ada", lastName: "Okoro" },
      });
  const candidate = { id: id(3100), firstName: "Fixture", lastName: "Responder" },
    second = { id: id(3101), firstName: "Fixture", lastName: "Second Responder" };
  const state = {
    f,
    row,
    kind,
    candidate,
    snapshot,
    mode: "normal" as
      | "normal"
      | "lost"
      | "malformed"
      | "rejected"
      | "timeout"
      | "throttled"
      | "candidate-failure"
      | "candidate-mismatch",
    writes: [] as { path: string; body: Record<string, unknown> }[],
    candidateReads: 0,
    revoke(action: "CARE_CASE_ASSIGN" | "CARE_PUBLIC_REPLY" | "CARE_CASE_VIEW") {
      f.base.access.assignments = f.base.access.assignments.filter(
        (a) =>
          !definitionForAssignment({
            ...a,
            templateVersion: a.templateVersion ?? 1,
          })?.actions.some((c) => c === action),
      );
      f.base.access.version++;
      snapshot();
    },
  };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Isolated granular Care fixture",
      meta: { requestId: "care-cases" },
    },
  });
  const fail = (status: number) => ({
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
      message: "Isolated Care failure",
    },
  });
  await page.route(
    new RegExp(
      `/api/v1/staff/workforce/${kind}/${row.id}/(?:assignees|assignment)(?:\\?|$)`,
    ),
    async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.pathname.endsWith("/assignees") && req.method() === "GET") {
        state.candidateReads++;
        if (state.mode === "candidate-failure") return route.fulfill(fail(503));
        const q = (url.searchParams.get("q") ?? "").toLowerCase();
        const cursor = url.searchParams.get("cursor");
        const items = [candidate, second].filter((p) =>
          `${p.firstName} ${p.lastName}`.toLowerCase().includes(q),
        );
        return route.fulfill(
          ok({
            items: cursor ? [] : items,
            branchId: row.branchId,
            access: f.base.access,
            generatedAt: new Date().toISOString(),
            ...(kind === "enquiries"
              ? {
                  enquiryId: row.id,
                  enquiryVersion: state.mode === "candidate-mismatch" ? 999 : row.version,
                }
              : {
                  complaintId: row.id,
                  complaintVersion:
                    state.mode === "candidate-mismatch" ? 999 : row.version,
                }),
          }),
        );
      }
      if (!url.pathname.endsWith("/assignment") || req.method() !== "PATCH")
        return route.fallback();
      const body = req.postDataJSON();
      state.writes.push({ path: url.pathname, body });
      if (state.mode === "rejected" || body.expectedVersion !== row.version)
        return route.fulfill(fail(409));
      const chosen = [candidate, second].find((v) => v.id === body.staffId);
      if (!chosen) return route.fulfill(fail(409));
      const previousStaffId = "assignedStaffId" in row ? row.assignedStaffId : null;
      Object.assign(row, {
        assignedStaffId: chosen.id,
        assignedStaff: chosen,
        version: row.version + 1,
        updatedAt: new Date().toISOString(),
      });
      if (state.mode === "lost") return route.abort("failed");
      if (state.mode === "timeout") return route.fulfill(fail(408));
      if (state.mode === "throttled") return route.fulfill(fail(429));
      return route.fulfill(
        ok({
          id: state.mode === "malformed" ? id(3999) : row.id,
          branchId: row.branchId,
          version: row.version,
          action: "assignment",
          actorUserId: f.base.access.userId,
          access: f.base.access,
          generatedAt: new Date().toISOString(),
          assignmentReceipt: { staffId: chosen.id, previousStaffId, reason: body.reason },
        }),
      );
    },
  );
  return state;
}
