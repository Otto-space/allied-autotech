import type { Page } from "@playwright/test";
import { workBookingsFixture, bookingId } from "./work-bookings";
import { promotionRecord } from "./work-promotions";
export const promotionDetailId = bookingId(6200);
export const promotionEditStorageKey = `aat:promotion-edit:v1:${bookingId(302)}:ADMIN:${promotionDetailId}`;
export async function promotionDetailFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role),
    state = {
      mode: "normal",
      writeMode: "normal",
      record: { ...promotionRecord(), id: promotionDetailId },
      reads: [] as string[],
      writes: [] as { body: Record<string, unknown>; method: string; csrf: string }[],
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic promotion detail",
      data,
      meta: { requestId: "promotion-detail-qa" },
    },
  });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "promotion-detail-csrf".repeat(3) })),
  );
  await page.route("**/api/v1/admin/promotions**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "GET") {
      state.reads.push(path);
      if (path === "/api/v1/admin/promotions") return route.fulfill(ok({ items: [] }));
      if (state.mode === "hold") {
        const snapshot = { ...state.record };
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
        return route.fulfill(ok(snapshot));
      }
      if (["error", "denied", "missing"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "error" ? 503 : state.mode === "denied" ? 403 : 404,
          json: {
            success: false,
            error: {
              code:
                state.mode === "error"
                  ? "DATABASE_UNAVAILABLE"
                  : state.mode === "denied"
                    ? "FORBIDDEN"
                    : "NOT_FOUND",
            },
          },
        });
      if (state.mode === "malformed")
        return route.fulfill(ok({ ...state.record, endsAt: state.record.startsAt }));
      if (state.mode === "mismatch")
        return route.fulfill(ok({ ...state.record, id: bookingId(6201) }));
      return route.fulfill(ok(state.record));
    }
    const body = req.postDataJSON();
    state.writes.push({
      body,
      method: req.method(),
      csrf: req.headers()["x-csrf-token"],
    });
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["error", "reject", "408", "429", "stale"].includes(state.writeMode)) {
      if (state.writeMode === "stale")
        state.record = {
          ...state.record,
          name: "Changed by another administrator",
          version: state.record.version + 1,
        };
      return route.fulfill({
        status:
          state.writeMode === "error"
            ? 503
            : ["reject", "stale"].includes(state.writeMode)
              ? 409
              : Number(state.writeMode),
        json: {
          success: false,
          error: {
            code:
              state.writeMode === "stale"
                ? "STALE_VERSION"
                : state.writeMode === "reject"
                  ? "CONFLICT"
                  : "REQUEST_FAILED",
          },
        },
      });
    }
    state.record = { ...state.record, ...body, version: state.record.version + 1 };
    if (state.writeMode === "lost") return route.abort("failed");
    if (state.writeMode === "malformed") return route.fulfill(ok({ id: "bad" }));
    if (state.writeMode === "mismatch")
      return route.fulfill(ok({ ...state.record, code: "WRONG" }));
    if (state.writeMode === "wrongId")
      return route.fulfill(ok({ ...state.record, id: bookingId(6201) }));
    return route.fulfill(ok(state.record));
  });
  return { base, state };
}
