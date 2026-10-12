import { expect, type Page, type Route } from "@playwright/test";
const id = (n: number) => `ec000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const reason = "Synthetic request for review of the supplied products.";
const note = "Synthetic review with a documented monetary and condition basis.";
const initialOrder = () => ({
  id: id(1),
  orderNumber: "SYNTHETIC-AFTERCARE-ORDER",
  status: "COMPLETED",
  fulfillmentMethod: "COLLECTION",
  currency: "NGN",
  subtotalKobo: "40000",
  totalKobo: "40000",
  discountAmountKobo: "0",
  deliveryFeeKobo: "0",
  taxKobo: "0",
  version: 3,
  createdAt: "2026-01-01T10:00:00Z",
  confirmedAt: "2026-01-01T11:00:00Z",
  paymentDueAt: null,
  paidAt: "2026-01-01T11:00:00Z" as string | null,
  fulfillmentEvidenceAt: null as string | null,
  fulfillmentEvidenceReference: null as string | null,
  invoice: null,
  branch: { id: id(2), code: "TEST", name: "Synthetic workshop" },
  items: [3, 4].map((n) => ({
    id: id(n),
    productId: id(n + 10),
    productName: `Synthetic product ${n}`,
    sku: `TEST-${n}`,
    quantity: 2,
    unitPriceKobo: "10000",
    subtotalKobo: "20000",
  })),
});
const initialRecord = () => ({
  id: id(5),
  orderId: id(1),
  kind: "RETURN",
  status: "REQUESTED",
  reason,
  items: [{ orderItemId: id(3), quantity: 1 }],
  requestedAt: "2026-09-01T10:00:00Z",
  receivedAt: null as string | null,
  inspectedAt: null as string | null,
  goodCondition: null as boolean | null,
  approvedFeeKobo: null as string | null,
  reviewedAt: null as string | null,
  reviewNote: null as string | null,
  inspectionNote: null as string | null,
  refundDueAt: null,
  refundClockStatus: "PENDING",
});
const reply = (route: Route, data: unknown) =>
  route.fulfill({
    json: {
      success: true,
      data,
      message: "Synthetic response",
      meta: { requestId: "aftercare-test" },
    },
  });
const fail = (route: Route, status: number) =>
  route.fulfill({
    status,
    json: {
      success: false,
      error: { code: status === 409 ? "CONFLICT" : "DATABASE_UNAVAILABLE" },
    },
  });
export async function customerAftercareFixture(
  page: Page,
  options: {
    staff?: boolean;
    history?: boolean;
    outcome?: "unknown" | "committed-unknown" | "mismatch" | "stale";
  } = {},
) {
  const state = {
    order: initialOrder(),
    history: options.history ? [initialRecord()] : [],
    writes: [] as { endpoint: string; body: Record<string, unknown> }[],
    failOrder: false,
    failHistory: false,
    failPermission: false,
    canDecide: true,
    wrongPermission: false,
    wrongBranch: false,
    orderReads: 0,
    historyReads: 0,
    profileReads: 0,
    sessionUserId: id(7),
    sessionRole: options.staff ? "STAFF" : "CUSTOMER",
  };
  await page.route("**/api/v1/**", async (route) => {
    const endpoint = new URL(route.request().url()).pathname.replace("/api/v1", "");
    if (endpoint === "/auth/session")
      return reply(route, {
        id: id(6),
        user: {
          id: state.sessionUserId,
          email: "synthetic@example.test",
          role: state.sessionRole,
        },
        mfaRequired: !!options.staff,
        mfaVerifiedAt: options.staff ? "2026-09-01T10:00:00Z" : null,
      });
    if (endpoint === "/auth/csrf")
      return reply(route, { csrfToken: "aftercare-csrf-".repeat(4) });
    if (endpoint === "/staff/profile") {
      state.profileReads++;
      return state.failPermission
        ? fail(route, 503)
        : reply(route, {
            id: id(state.wrongPermission ? 99 : 7),
            email: "synthetic@example.test",
            role: "STAFF",
            status: "ACTIVE",
            staffProfile: {
              id: id(8),
              firstName: "Synthetic",
              lastName: "Reviewer",
              branchId: id(state.wrongBranch ? 99 : 2),
            },
            capabilities: state.canDecide ? ["FINANCE_POLICY_APPROVE"] : [],
          });
    }
    if (
      route.request().method() === "GET" &&
      endpoint === `/${options.staff ? "staff" : "customers"}/orders/${id(1)}`
    ) {
      state.orderReads++;
      return state.failOrder ? fail(route, 503) : reply(route, state.order);
    }
    if (
      route.request().method() === "GET" &&
      endpoint.endsWith(`/orders/${id(1)}/aftercare`)
    ) {
      state.historyReads++;
      return state.failHistory ? fail(route, 503) : reply(route, state.history);
    }
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      state.writes.push({ endpoint, body });
      expect(route.request().headers()["x-csrf-token"]).toBe("aftercare-csrf-".repeat(4));
      if (options.outcome === "unknown") return route.abort("failed");
      if (options.outcome === "stale") return fail(route, 409);
      if (endpoint.endsWith("/fulfillment-evidence")) {
        state.order.fulfillmentEvidenceAt = body.at;
        state.order.fulfillmentEvidenceReference = body.reference;
        return reply(route, {
          id: id(1),
          fulfillmentEvidenceAt: body.at,
          fulfillmentEvidenceReference:
            options.outcome === "mismatch" ? "Wrong reference" : body.reference,
        });
      }
      if (endpoint.endsWith("/review")) {
        const old = state.history[0]!;
        const saved = {
          ...old,
          status: body.stage,
          ...(body.stage === "RECEIVED" ? { receivedAt: "2026-09-02T10:00:00Z" } : {}),
          ...(body.stage === "INSPECTED"
            ? {
                inspectedAt: "2026-09-02T11:00:00Z",
                goodCondition: body.goodCondition,
                inspectionNote: body.note,
              }
            : {}),
          ...(["APPROVED", "REJECTED"].includes(body.stage)
            ? {
                reviewedAt: "2026-09-02T12:00:00Z",
                reviewNote: body.note,
                approvedFeeKobo: body.approvedFeeKobo ?? "0",
              }
            : {}),
        };
        state.history = [saved];
        return reply(
          route,
          options.outcome === "mismatch"
            ? { ...saved, items: [{ orderItemId: id(4), quantity: 1 }] }
            : saved,
        );
      }
      const saved = {
        ...initialRecord(),
        kind: endpoint.endsWith("/returns") ? "RETURN" : (body.kind ?? "CANCELLATION"),
        reason: body.reason,
        items:
          body.items ??
          state.order.items.map((item) => ({
            orderItemId: item.id,
            quantity: item.quantity,
          })),
      };
      state.history = state.history.length ? state.history : [saved];
      if (options.outcome === "committed-unknown") return route.abort("failed");
      if (endpoint.endsWith("/cancel")) {
        state.order.status = "PROCESSING";
        return reply(route, { ...state.order, cancellationRequest: state.history[0] });
      }
      return reply(
        route,
        options.outcome === "mismatch" ? { ...saved, orderId: id(99) } : state.history[0],
      );
    }
    return fail(route, 404);
  });
  return state;
}
