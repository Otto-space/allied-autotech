import type { Page } from "@playwright/test";
import { allieConversationFixture, type AllieFixtureRole } from "./allie-conversation";
import {
  handoffBody,
  handoffDraftSchema,
  type HandoffDraft,
} from "../../lib/learning/handoff";
import type { AllieConversation } from "../../lib/learning/conversation";

export const handoffId = (n: number) =>
  `c3000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export async function allieHandoffFixture(
  page: Page,
  role: AllieFixtureRole = "CUSTOMER",
) {
  const help = await allieConversationFixture(page, role);
  const reviews = new Map<string, { draft: HandoffDraft; preview: object }>();
  const receipts = new Map<string, object>();
  const cancelled = new Set<string>();
  const state = {
    help,
    writes: [] as { path: string; key: string; method: string; body: unknown }[],
    created: 0,
    replies: 0,
    loseSave: false,
    failPreview: false,
    stale: false,
    failChoices: false,
    malformed: false,
  };
  const branch = { id: handoffId(1), code: "SYNTHETIC", name: "Synthetic workshop" };
  const record = (kind: string, closed = false) => ({
    id: handoffId(kind === "enquiries" ? (closed ? 4 : 2) : 3),
    branchId: branch.id,
    branch,
    assignedStaffId: null,
    assignedStaff: null,
    subject: closed ? "Synthetic closed request" : `Synthetic existing ${kind}`,
    version: 2,
    createdAt: "2026-10-27T00:00:00.000Z",
    updatedAt: "2026-10-27T00:00:00.000Z",
    resolvedAt: null,
    closedAt: null,
    status: closed ? "CLOSED" : "OPEN",
    type: "GENERAL",
    message: "Synthetic original enquiry",
    description: "Synthetic original complaint",
    resolution: null,
    priority: "MEDIUM",
    productId: null,
    serviceId: null,
    bookingId: null,
    quoteId: null,
    vehicleListingId: null,
    orderId: null,
    vehicleTransactionId: null,
  });
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url()),
      path = url.pathname.replace("/api/v1", ""),
      method = request.method();
    const isHandoff = path.startsWith("/customers/support/handoff");
    if (
      !isHandoff &&
      path !== "/public/branches" &&
      !/^\/customers\/support\/(enquiries|complaints)$/.test(path)
    )
      return route.fallback();
    const ok = (data: unknown, status = 200) =>
      route.fulfill({
        status,
        json: {
          success: true,
          message: "Synthetic handoff fixture",
          data,
          meta: { requestId: "synthetic-handoff" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({
        status,
        json: {
          success: false,
          message: "Synthetic failure",
          error: { code },
          meta: { requestId: "synthetic-handoff" },
        },
      });
    if (!isHandoff) {
      if (state.failChoices) return fail(503, "UNAVAILABLE");
      if (path === "/public/branches") return ok({ items: [branch] });
      const kind = path.endsWith("enquiries") ? "enquiries" : "complaints";
      return ok({
        items: [record(kind), ...(kind === "enquiries" ? [record(kind, true)] : [])],
      });
    }
    if (role !== "CUSTOMER") return fail(403, "FORBIDDEN");
    const key = request.headers()["idempotency-key"] ?? path.split("/").at(-1)!;
    const body = method === "POST" ? request.postDataJSON() : null;
    if (method !== "GET") state.writes.push({ path, key, method, body });
    if (path.endsWith("/preview") && method === "POST") {
      if (state.failPreview) return fail(429, "RATE_LIMITED");
      const draft = handoffDraftSchema.parse(body),
        target = draft.target;
      const preview = {
        target: {
          kind: target.kind,
          id: target.kind === "NEW_ENQUIRY" ? null : target.id,
          branchId: branch.id,
          branchName: branch.name,
          subject:
            target.kind === "NEW_ENQUIRY"
              ? target.subject
              : `Synthetic existing ${target.kind === "ENQUIRY" ? "enquiries" : "complaints"}`,
          version: target.kind === "NEW_ENQUIRY" ? null : target.expectedVersion,
        },
        body: handoffBody(draft, help.conversation as AllieConversation),
        audience: "CUSTOMER_CARE",
        mode: "QUEUED",
        excerptCount: draft.excerpts?.selections.length ?? 0,
        review: {
          token: "a".repeat(64),
          expiresAt: new Date(Date.now() + 600000).toISOString(),
        },
        recoveryExpiresAt: new Date(Date.now() + 900000).toISOString(),
      };
      reviews.set(key, { draft, preview });
      return ok(
        state.malformed
          ? { ...preview, body: preview.body + "\nUnselected transcript" }
          : preview,
      );
    }
    if (path.includes("/drafts/") && method === "GET") {
      if (receipts.has(key)) return ok(receipts.get(key));
      if (cancelled.has(key)) return ok({ state: "CANCELLED", cancelled: true });
      const stored = reviews.get(key);
      if (!stored) return fail(404, "NOT_FOUND");
      if (state.stale) {
        const draft = { ...stored.draft };
        delete draft.excerpts;
        return ok({
          state: "NEEDS_REVIEW",
          draft,
          preview: null,
          excerptsCleared: true,
          expiresAt: new Date(Date.now() + 900000).toISOString(),
        });
      }
      return ok({
        state: "REVIEW",
        ...stored,
        expiresAt: new Date(Date.now() + 900000).toISOString(),
      });
    }
    if (path.includes("/drafts/") && method === "DELETE") {
      if (receipts.has(key)) return ok(receipts.get(key));
      reviews.delete(key);
      cancelled.add(key);
      return ok({ state: "CANCELLED", cancelled: true });
    }
    if (path === "/customers/support/handoff" && method === "POST") {
      if (cancelled.has(key)) return fail(409, "IDEMPOTENCY_CONFLICT");
      const stored = reviews.get(key);
      if (!stored) return fail(409, "CONFLICT");
      if (!receipts.has(key)) {
        const target = stored.draft.target,
          createdNew = target.kind === "NEW_ENQUIRY";
        receipts.set(key, {
          state: "SAVED",
          mode: "QUEUED",
          replayed: false,
          reference: {
            kind: target.kind === "COMPLAINT" ? "COMPLAINT" : "ENQUIRY",
            id: createdNew ? handoffId(10 + state.created++) : target.id,
            branchId: branch.id,
            createdNew,
            messageId: createdNew ? null : handoffId(30 + state.replies++),
          },
        });
        if (stored.draft.excerpts) {
          // The actual API closes the shared source atomically. A later explicit
          // Start must receive a different context, never replay that closed ID.
          help.created = false;
          help.conversation = {
            ...help.conversation,
            id: handoffId(200),
            version: 1,
            messages: [],
            pending: null,
          };
        }
      }
      if (state.loseSave) return route.abort("failed");
      return ok(receipts.get(key), 201);
    }
    help.unexpected.push(method + " " + path);
    return fail(503, "FIXTURE_ROUTE_NOT_ALLOWED");
  });
  return state;
}
