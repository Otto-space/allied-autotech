import type { Page } from "@playwright/test";
export type AllieFixtureRole = "PUBLIC" | "CUSTOMER" | "STAFF" | "ADMIN" | "SUPER_ADMIN";
const id = "b0000000-0000-4000-8000-000000000001";
export async function allieConversationFixture(
  page: Page,
  role: AllieFixtureRole = "PUBLIC",
) {
  const article = {
    id: "parts-fitment",
    title: "Find a part and understand compatibility",
    summary: "Matching a name is not proof that a part fits your vehicle.",
    prerequisites: "Use the actual product and vehicle details.",
    steps: [
      "Open Parts. Search by product name, brand or part number.",
      "Read the compatibility evidence. Compatible, incompatible and not confirmed have different meanings.",
    ],
    outcome: "Review the available evidence before enquiring.",
    recovery: "Ask the team when evidence is missing.",
    keywords: "parts compatibility",
    page: "parts",
    href: "/parts",
    source: "Isolated reviewed-help fixture",
    version: 2,
    status: "published",
    reviewedAt: "2026-10-26",
  };
  const audience =
    role === "PUBLIC" ? "public" : role === "CUSTOMER" ? "customer" : "work";
  const state = {
    data: {
      accessKey: "a".repeat(64),
      audience,
      contentVersion: 1,
      mode: "browse_enquiries",
      flags: { ai: true, guides: true, practice: true },
      articles: [article],
      guides: [],
      scenarios: [],
    },
    conversation: {
      id,
      version: 1,
      audience,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      messages: [] as { operationId: string; question: string; answer: object }[],
      historyReset: false,
      pending: null as { operationId: string; state: string } | null,
    },
    answerOverride: null as object | null,
    created: false,
    hold: false,
    unknown: false,
    quota: false,
    cancelled: false,
    release: undefined as (() => void) | undefined,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    unexpected: [] as string[],
  };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request(),
      endpoint = new URL(request.url()).pathname.replace("/api/v1", ""),
      method = request.method();
    const body = method === "GET" ? {} : (request.postDataJSON() ?? {});
    if (method !== "GET") state.writes.push({ path: endpoint, body });
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Isolated Allie browser fixture",
          meta: { requestId: "allie-browser" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({
        status,
        json: {
          success: false,
          message: "Isolated failure",
          error: { code },
          meta: { requestId: "allie-browser" },
        },
      });
    if (endpoint === "/auth/session")
      return role === "PUBLIC"
        ? fail(401, "AUTHENTICATION_REQUIRED")
        : ok({
            id,
            user: { id, role, email: "synthetic-allie@example.test" },
            mfaRequired: role !== "CUSTOMER",
            mfaVerifiedAt: role === "CUSTOMER" ? null : "2026-10-27T00:00:00.000Z",
            expiresAt: "2027-01-01T00:00:00.000Z",
            idleExpiresAt: "2027-01-01T00:00:00.000Z",
          });
    if (endpoint === "/auth/csrf")
      return ok({ csrfToken: "synthetic-allie-csrf-".repeat(3) });
    if (/^\/(?:public\/)?learning\/catalogue$/.test(endpoint)) return ok(state.data);
    if (endpoint === "/public/branches")
      return ok({ items: [{ id, code: "TEST", name: "Isolated test workshop" }] });
    if (endpoint.includes("/notifications/summary"))
      return ok({ unreadCount: 0, groups: [], destinations: [] });
    const prefix =
      role === "PUBLIC" ? "/public/learning/assistant" : "/learning/assistant";
    if (endpoint === prefix + "/session")
      return ok({
        csrfToken: "synthetic-guest-csrf-".repeat(3),
        expiresAt: state.conversation.expiresAt,
      });
    if (endpoint === prefix + "/conversations") {
      if (method === "GET")
        return ok({
          items: state.created
            ? [
                {
                  id,
                  createdAt: "2026-10-27T00:00:00.000Z",
                  expiresAt: state.conversation.expiresAt,
                },
              ]
            : [],
        });
      if (method === "POST") {
        state.created = true;
        return ok({ replayed: false, conversation: state.conversation });
      }
    }
    if (endpoint === prefix + "/conversations/" + id) {
      if (method === "GET") return ok(state.conversation);
      if (method === "DELETE") {
        state.created = false;
        state.cancelled = true;
        state.conversation.messages = [];
        state.conversation.pending = null;
        return ok({ cleared: true });
      }
    }
    if (endpoint === prefix + "/conversations/" + id + "/cancel") {
      state.cancelled = true;
      state.conversation.pending = null;
      state.conversation.version++;
      return ok({ cancelled: true, status: "CANCELLED" });
    }
    if (endpoint === prefix + "/conversations/" + id + "/turns") {
      if (state.quota) return fail(429, "RATE_LIMITED");
      if (state.hold) {
        state.conversation.pending = {
          operationId: String(body.operationId),
          state: "pending",
        };
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      }
      if (!state.cancelled) {
        state.conversation.messages.push({
          operationId: String(body.operationId),
          question: String(body.question),
          answer: state.answerOverride ?? {
            kind: "answer",
            answer:
              "A name match does not confirm compatibility. Check the evidence for your vehicle.",
            steps: [
              "Search by part name or number.",
              "Review any make, model, year and engine restrictions.",
            ],
            caveat: "Missing evidence means fitment is not confirmed.",
            sourceIds: ["parts-fitment@v2"],
            actionIds: ["read:parts-fitment"],
            sources: [
              {
                id: "parts-fitment@v2",
                articleId: article.id,
                version: 2,
                title: article.title,
                href: "/learn?article=parts-fitment",
              },
            ],
            actions: [
              {
                id: "read:parts-fitment",
                kind: "article",
                label: "Read compatibility help",
                href: "/learn?article=parts-fitment",
                sourceId: "parts-fitment@v2",
              },
            ],
          },
        });
        state.conversation.messages = state.conversation.messages.slice(-6);
        state.conversation.pending = null;
        state.conversation.version += 2;
      }
      if (state.unknown) return route.abort("failed");
      try {
        return await ok({ replayed: false, conversation: state.conversation });
      } catch {
        /* A stopped browser request need not accept the late fixture packet. */
      }
      return;
    }
    state.unexpected.push(method + " " + endpoint);
    return fail(503, "FIXTURE_ROUTE_NOT_ALLOWED");
  });
  return state;
}
