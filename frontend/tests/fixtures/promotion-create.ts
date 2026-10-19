import type { Page } from "@playwright/test";
import { workBookingsFixture, bookingId } from "./work-bookings";
import { promotionRecord } from "./work-promotions";
export const creationValues = () => ({
  name: "Workshop essentials",
  code: "care12",
  description: "October workshop offer",
  discountType: "PERCENTAGE",
  percentage: "12.34",
  fixedAmount: "",
  minimumOrderAmount: "0",
  maximumDiscountAmount: "99999999999999.99",
  usageLimit: "20",
  perCustomerLimit: "2",
  startsAt: "2026-10-17T10:00:37.123",
  endsAt: "2026-11-17T10:00:37.456",
  isActive: false,
});
export const promotionCreationStorageKey = `aat:promotion-create:v1:${bookingId(302)}:ADMIN`;
export async function promotionCreateFixture(page: Page, role = "ADMIN") {
  const base = await workBookingsFixture(page, role),
    state = {
      mode: "normal",
      record: undefined as ReturnType<typeof promotionRecord> | undefined,
      reads: [] as string[],
      writes: [] as { body: Record<string, unknown>; key: string; csrf: string }[],
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      message: "Synthetic creation",
      data,
      meta: { requestId: "promotion-create-qa" },
    },
  });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "promotion-create-test-csrf".repeat(3) })),
  );
  await page.route("**/api/v1/admin/promotions**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "GET") {
      state.reads.push(path);
      if (path.includes("/creation-receipts/"))
        return route.fulfill(
          ok({
            key:
              state.mode === "receiptMismatch"
                ? `promotion-v1.${Date.now()}.${crypto.randomUUID()}`
                : path.split("/").at(-1),
            promotionId: state.record?.id ?? null,
          }),
        );
      return route.fulfill(ok(state.record ?? promotionRecord()));
    }
    const body = req.postDataJSON();
    state.writes.push({
      body,
      key: req.headers()["idempotency-key"],
      csrf: req.headers()["x-csrf-token"],
    });
    if (state.mode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["error", "reject", "408", "429"].includes(state.mode))
      return route.fulfill({
        status:
          state.mode === "reject"
            ? 409
            : state.mode === "error"
              ? 503
              : Number(state.mode),
        json: {
          success: false,
          error: {
            code: state.mode === "reject" ? "IDEMPOTENCY_CONFLICT" : "REQUEST_FAILED",
          },
        },
      });
    const replayed = !!state.record;
    state.record ??= { ...promotionRecord(), ...body, id: bookingId(6100), version: 0 };
    if (state.mode === "lost") return route.abort("failed");
    if (state.mode === "malformed") return route.fulfill(ok({ id: "bad" }));
    return route.fulfill(
      ok({
        ...state.record,
        name: state.mode === "mismatch" ? "Different offer" : state.record.name,
        replayed,
      }),
    );
  });
  return { base, state };
}
export async function fillPromotionCreation(page: Page) {
  const values = creationValues();
  for (const [label, value] of [
    ["Promotion name", values.name],
    ["Redemption code (optional)", values.code],
    ["Description (optional)", values.description],
    ["Discount percentage", values.percentage],
    ["Minimum subtotal (NGN, optional)", values.minimumOrderAmount],
    ["Discount cap (NGN, optional)", values.maximumDiscountAmount],
    ["Total usage limit (optional)", values.usageLimit],
    ["Per-customer limit (optional)", values.perCustomerLimit],
    ["Starts at (Lagos time)", values.startsAt],
    ["Ends at (Lagos time)", values.endsAt],
  ])
    await page.getByLabel(label, { exact: true }).fill(value);
}
