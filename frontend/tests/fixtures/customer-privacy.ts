import type { Page } from "@playwright/test";
import type { PrivacyRequest } from "../../lib/api/privacy-schemas";
export const privacyId = (n: number) =>
  `ea000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const privacyRecord = (
  n = 10,
  status: PrivacyRequest["status"] = "UNDER_REVIEW",
): PrivacyRequest => ({
  id: privacyId(n),
  userId: privacyId(2),
  kind: "DELETION",
  reason: "Please review the personal information associated with my account.",
  status,
  createdAt: "2026-10-10T09:00:00Z",
  reviewedAt: status === "REQUESTED" ? null : "2026-10-11T10:00:00Z",
  reviewNote:
    status === "REQUESTED"
      ? null
      : "We are reviewing your request and the records concerned.",
});
export async function privacyFixture(page: Page, role = "CUSTOMER") {
  const state = {
    mode: "normal",
    outcome: "normal",
    role,
    owner: privacyId(2),
    items: [privacyRecord()],
    reads: [] as URL[],
    writes: [] as Record<string, unknown>[],
    release: undefined as (() => void) | undefined,
  };
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const endpoint = url.pathname.replace("/api/v1", "");
    const reply = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Isolated privacy QA",
          meta: { requestId: "privacy-qa" },
        },
      });
    const fail = (status: number) =>
      route.fulfill({
        status,
        headers: { "Retry-After": "2" },
        json: {
          success: false,
          error: {
            code:
              status === 403
                ? "FORBIDDEN"
                : status === 429
                  ? "RATE_LIMITED"
                  : "DATABASE_UNAVAILABLE",
          },
        },
      });
    if (endpoint === "/auth/session")
      return reply({
        id: privacyId(1),
        user: { id: state.owner, email: "amara@example.test", role: state.role },
        mfaRequired: state.role !== "CUSTOMER",
        mfaVerifiedAt: state.role === "CUSTOMER" ? null : "2026-10-10T10:00:00Z",
      });
    if (endpoint === "/auth/csrf")
      return reply({ csrfToken: "synthetic-privacy-qa-csrf-token-over-thirty-two" });
    if (endpoint === "/customers/privacy-requests") {
      if (route.request().method() === "GET") {
        state.reads.push(url);
        if (state.mode === "hold")
          await new Promise<void>((resolve) => {
            state.release = resolve;
          });
        if (state.mode === "offline") return route.abort("internetdisconnected");
        if (state.mode === "error") return fail(503);
        if (state.mode === "denied") return fail(403);
        if (state.mode === "malformed") return reply({ items: [{}] });
        const cursor = url.searchParams.get("cursor");
        const start = cursor ? state.items.findIndex((x) => x.id === cursor) + 1 : 0;
        const items =
          state.mode === "empty"
            ? []
            : state.items
                .slice(start, start + 10)
                .map((x) =>
                  state.mode === "foreign" ? { ...x, userId: privacyId(99) } : x,
                );
        return reply({
          items,
          nextCursor: state.items.length > start + 10 ? items.at(-1)?.id : null,
        });
      }
      const body = route.request().postDataJSON();
      state.writes.push(body);
      if (state.outcome === "hold")
        await new Promise<void>((resolve) => {
          state.release = resolve;
        });
      if (state.outcome === "rate") return fail(429);
      if (state.outcome === "denied") return fail(403);
      let saved = state.items.find(
        (x) => x.kind === body.kind && x.status !== "REJECTED",
      );
      if (!saved) {
        saved = { ...privacyRecord(100 + state.writes.length, "REQUESTED"), ...body };
        state.items.unshift(saved!);
      }
      if (state.outcome === "unknown") return fail(503);
      if (state.outcome === "mismatch") return reply({ ...saved, userId: privacyId(99) });
      return reply(saved);
    }
    return reply({ items: [], nextCursor: null });
  });
  return state;
}
