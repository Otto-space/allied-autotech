import type { Page } from "@playwright/test";
import { workInvoiceFixture, id } from "./work-invoices";
import type { AuditEvent } from "@/lib/api/audit-schemas";
export { id };
export function auditRow(n = 0): AuditEvent {
  return {
    id: id(300000 + n),
    userId: n === 2 ? null : id(302),
    user: n === 2 ? null : { role: "ADMIN" },
    action: (["UPDATE", "ROLE_CHANGE", "LOGIN_FAILED"] as const)[n % 3]!,
    entityType: n % 3 === 0 ? "BRANCH" : "USER",
    entityId: id(301000 + n),
    requestId: `audit-synthetic-${n}`,
    createdAt: new Date(Date.parse("2026-10-19T08:30:00.000Z") - n * 60000).toISOString(),
    oldValues: n === 0 ? { active: true } : null,
    newValues: n === 0 ? { active: true, changedFields: "name,phone", description: "Synthetic branch edit" } : { result: n === 1 ? "Role updated" : "Sign-in rejected" },
  };
}
export async function workAuditFixture(page: Page, role = "ADMIN") {
  const base = await workInvoiceFixture(page, role);
  const state = { base, mode: "normal", rows: Array.from({ length: 3 }, (_, n) => auditRow(n)), reads: [] as URL[], writes: [] as string[] };
  await page.route("**/api/v1/admin/audit**", async route => {
    const url = new URL(route.request().url()), q = url.searchParams;
    if (route.request().method() !== "GET") { state.writes.push(route.request().method()); return route.fulfill({ status: 405 }); }
    state.reads.push(url);
    if (["error", "denied"].includes(state.mode)) return route.fulfill({ status: state.mode === "denied" ? 403 : 503, json: { success: false, error: { code: state.mode === "denied" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE" } } });
    let rows = state.mode === "empty" ? [] : state.rows;
    for (const key of ["action", "entityType", "userId", "entityId", "requestId"] as const) if (q.has(key)) rows = rows.filter(r => r[key] === q.get(key));
    if (q.has("from")) rows = rows.filter(r => Date.parse(r.createdAt) >= Date.parse(q.get("from")!));
    if (q.has("to")) rows = rows.filter(r => Date.parse(r.createdAt) <= Date.parse(q.get("to")!));
    if (q.has("cursor")) { const index = rows.findIndex(r => r.id === q.get("cursor")); rows = index < 0 ? [] : rows.slice(index + 1); }
    const items = rows.slice(0, 25);
    return route.fulfill({ json: { success: true, data: { items, ...(rows.length > 25 ? { nextCursor: items.at(-1)!.id } : {}) }, message: "Synthetic audit QA", meta: { requestId: "audit-test" } } });
  });
  return state;
}
