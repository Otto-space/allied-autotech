import type { Page } from "@playwright/test";
import type { WorkAftercareRequest } from "@/lib/admin/work-aftercare";
import { workOrderDetailFixture, bookingId } from "./work-order-detail";
export { bookingId };
export function workAftercareRecord(n = 0): WorkAftercareRequest {
  return {
    id: bookingId(1400 + n),
    orderId: bookingId(1100),
    kind: n ? "CANCELLATION" : "RETURN",
    status: n ? "REJECTED" : "RECEIVED",
    reason: n
      ? "Customer asked us to review cancellation."
      : "One brake pad set needs inspection.",
    items: [{ orderItemId: bookingId(1200), quantity: 1 }],
    requestedAt: "2026-10-17T08:10:00.000Z",
    receivedAt: n ? null : "2026-10-17T08:20:00.000Z",
    inspectedAt: null,
    goodCondition: null,
    approvedFeeKobo: n ? "0" : null,
    reviewedAt: n ? "2026-10-17T08:30:00.000Z" : null,
    reviewNote: n
      ? "The request was reviewed and not approved on the recorded basis."
      : null,
    inspectionNote: null,
    refundDueAt: null,
    refundClockStatus: "PENDING",
  };
}
export async function workAftercareFixture(page: Page, role = "ADMIN") {
  const base = await workOrderDetailFixture(page, role);
  Object.assign(base.detail.record, {
    status: "COMPLETED",
    allowedTransitions: [],
    fulfillmentEvidenceAt: null,
    fulfillmentEvidenceReference: null,
    createdAt: "2026-10-16T08:00:00.000Z",
  });
  const state = {
    history: [workAftercareRecord(), workAftercareRecord(1)],
    mode: "normal",
    accessMode: "normal",
    canDecide: true,
    outcome: "success",
    reads: [] as string[],
    writes: [] as { path: string; body: Record<string, unknown>; csrf?: string }[],
    recovered: undefined as WorkAftercareRequest | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic aftercare",
          meta: { requestId: "work-aftercare-qa" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (path === "/staff/profile") {
      state.reads.push(path);
      if (state.accessMode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.accessMode === "denied") return fail(403, "FORBIDDEN");
      return ok({
        id: bookingId(state.accessMode === "mismatch" ? 999 : 302),
        email: "workshop@example.test",
        role,
        status: "ACTIVE",
        staffProfile: {
          id: bookingId(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: bookingId(state.accessMode === "branch" ? 999 : 101),
        },
        capabilities: state.canDecide ? ["FINANCE_POLICY_APPROVE"] : [],
      });
    }
    const list = path === `/staff/orders/${bookingId(1100)}/aftercare`,
      single = /^\/staff\/order-requests\/[^/]+$/.test(path),
      evidence = path.endsWith("/fulfillment-evidence"),
      review = /^\/staff\/order-requests\/[^/]+\/review$/.test(path);
    if (!(list || single || evidence || review)) return route.fallback();
    if (req.method() === "GET") {
      state.reads.push(path);
      if (state.mode === "error") return fail(503, "DATABASE_UNAVAILABLE");
      if (state.mode === "denied") return fail(403, "FORBIDDEN");
      if (state.mode === "malformed") return ok([{}]);
      if (single) {
        const row = [
          ...state.history,
          ...(state.recovered ? [state.recovered] : []),
        ].find((r) => path.endsWith(r.id));
        return row ? ok(row) : fail(404, "NOT_FOUND");
      }
      return ok(
        state.mode === "mismatch"
          ? state.history.map((r) => ({ ...r, orderId: bookingId(999) }))
          : state.mode === "empty"
            ? []
            : state.history,
      );
    }
    const body = req.postDataJSON() as Record<string, unknown>;
    state.writes.push({ path, body, csrf: req.headers()["x-csrf-token"] });
    if (state.outcome === "reject") return fail(409, "CONFLICT");
    if (evidence) {
      if (state.outcome !== "uncommitted")
        Object.assign(base.detail.record, {
          fulfillmentEvidenceAt: String(body.at),
          fulfillmentEvidenceReference: String(body.reference),
        });
      if (["uncertain", "uncommitted"].includes(state.outcome))
        return route.abort("failed");
      return ok({
        id: bookingId(state.outcome === "contradictory" ? 999 : 1100),
        fulfillmentEvidenceAt: body.at,
        fulfillmentEvidenceReference: body.reference,
      });
    }
    const record = state.history.find((r) => path.includes(r.id));
    if (!record) return fail(404, "NOT_FOUND");
    if (body.expectedStatus !== record.status) return fail(409, "CONFLICT");
    if (state.outcome !== "uncommitted")
      Object.assign(record, {
        status: body.stage,
        ...(body.stage === "RECEIVED"
          ? { receivedAt: "2026-10-17T08:40:00.000Z" }
          : body.stage === "INSPECTED"
            ? {
                inspectedAt: "2026-10-17T08:45:00.000Z",
                goodCondition: body.goodCondition,
                inspectionNote: body.note,
              }
            : {
                reviewedAt: "2026-10-17T08:50:00.000Z",
                reviewNote: body.note,
                approvedFeeKobo: body.approvedFeeKobo ?? "0",
              }),
      });
    if (["uncertain", "uncommitted"].includes(state.outcome))
      return route.abort("failed");
    return ok(
      state.outcome === "contradictory" ? { ...record, id: bookingId(999) } : record,
    );
  });
  return { ...base, aftercare: state };
}
