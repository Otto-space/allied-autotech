import type { Page } from "@playwright/test";
import { workSupportFixture, bookingId } from "./work-support";
import type { ModerationRecord } from "@/lib/admin/work-review-moderation";
import type { ReviewTarget } from "@/lib/api/review-schemas";
export { bookingId };
export function moderationRow(
  n = 0,
  target: ReviewTarget = "BUSINESS",
): ModerationRecord {
  const row: ModerationRecord = {
    id: bookingId(110000 + n),
    targetType: target,
    rating: (n % 5) + 1,
    title: n === 0 ? "Careful diagnosis and clear advice" : `Customer feedback ${n + 1}`,
    comment: "The team explained the diagnosis and the next service steps clearly.",
    createdAt: `2026-10-18T08:00:${String(n).padStart(2, "0")}.123Z`,
    updatedAt: "2026-10-18T09:00:37.123Z",
    status: "PENDING",
    version: n,
    productId: null,
    orderItemId: null,
    serviceId: null,
    bookingId: null,
    orderId: null,
    vehicleTransactionId: null,
    product: null,
    service: null,
    orderItem: null,
    order: null,
    booking: null,
    vehicleTransaction: null,
    moderationNote: null,
    moderatedAt: null,
    customer: { firstName: "Amina", lastName: "Okafor" },
  };
  if (target === "PRODUCT")
    Object.assign(row, {
      productId: bookingId(120000 + n),
      orderItemId: bookingId(130000 + n),
      product: { id: bookingId(120000 + n), name: "Brake pads", slug: "brake-pads" },
      orderItem: { id: bookingId(130000 + n), orderId: bookingId(140000 + n) },
    });
  if (target === "SERVICE")
    Object.assign(row, {
      serviceId: bookingId(150000 + n),
      bookingId: bookingId(160000 + n),
      service: {
        id: bookingId(150000 + n),
        name: "Engine diagnostics",
        slug: "engine-diagnostics",
      },
      booking: { id: bookingId(160000 + n), completedAt: "2026-10-17T08:00:37.123Z" },
    });
  if (target === "ORDER")
    Object.assign(row, {
      orderId: bookingId(140000 + n),
      order: { orderNumber: "SYNTHETIC-ORDER" },
    });
  if (target === "VEHICLE_TRANSACTION")
    Object.assign(row, {
      vehicleTransactionId: bookingId(170000 + n),
      vehicleTransaction: { transactionNumber: "SYNTHETIC-SALE" },
    });
  return row;
}
export async function workModerationFixture(page: Page, role = "ADMIN") {
  const base = await workSupportFixture(page, role),
    moderation = {
      records: [
        moderationRow(),
        moderationRow(1, "PRODUCT"),
        moderationRow(2, "SERVICE"),
      ],
      mode: "normal",
      directMode: "normal",
      profileMode: "normal",
      writeMode: "normal",
      profileReads: 0,
      reads: [] as URL[],
      directReads: [] as URL[],
      writes: [] as { path: string; body: Record<string, unknown> }[],
      heldProfile: undefined as (() => void) | undefined,
      heldWrite: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic moderation",
      meta: { requestId: "work-moderation" },
    },
  });
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill(ok({ csrfToken: "moderation-csrf-".repeat(3) })),
  );
  const fail = (status: number) => ({
    status,
    json: {
      success: false,
      error: {
        code:
          status === 409
            ? "CONFLICT"
            : status === 403
              ? "FORBIDDEN"
              : status === 404
                ? "NOT_FOUND"
                : "DATABASE_UNAVAILABLE",
      },
    },
  });
  await page.route("**/api/v1/staff/profile", async (route) => {
    moderation.profileReads++;
    if (moderation.profileMode === "hold")
      await new Promise<void>((r) => {
        moderation.heldProfile = r;
      });
    if (["error", "denied"].includes(moderation.profileMode))
      return route.fulfill(fail(moderation.profileMode === "error" ? 503 : 403));
    return route.fulfill(
      ok({
        id: bookingId(moderation.profileMode === "mismatch" ? 399 : 302),
        role,
        email: "moderation@example.test",
        status: moderation.profileMode === "inactive" ? "SUSPENDED" : "ACTIVE",
        capabilities: [],
        staffProfile: {
          id: bookingId(601),
          firstName: "Ada",
          lastName: "Okoro",
          branchId: bookingId(101),
        },
      }),
    );
  });
  await page.route("**/api/v1/staff/support/reviews**", async (route) => {
    const req = route.request(),
      u = new URL(req.url()),
      direct = !u.pathname.endsWith("/reviews"),
      mode = direct ? moderation.directMode : moderation.mode;
    if (req.method() === "GET") {
      (direct ? moderation.directReads : moderation.reads).push(u);
      if (["error", "denied", "missing"].includes(mode))
        return route.fulfill(
          fail(mode === "error" ? 503 : mode === "denied" ? 403 : 404),
        );
      if (direct) {
        const row = moderation.records.find((r) => r.id === u.pathname.split("/").at(-1));
        if (!row) return route.fulfill(fail(404));
        return route.fulfill(
          ok(
            mode === "malformed"
              ? { id: row.id }
              : mode === "mismatch"
                ? { ...row, id: bookingId(999) }
                : row,
          ),
        );
      }
      let rows = moderation.records.filter(
        (r) =>
          r.status === (u.searchParams.get("status") ?? "PENDING") &&
          (!u.searchParams.has("targetType") ||
            r.targetType === u.searchParams.get("targetType")) &&
          (!u.searchParams.has("reviewId") || r.id === u.searchParams.get("reviewId")),
      );
      if (mode === "empty") rows = [];
      const start = u.searchParams.has("cursor")
          ? rows.findIndex((r) => r.id === u.searchParams.get("cursor")) + 1
          : 0,
        items = rows.slice(start, start + 25);
      return route.fulfill(
        ok(
          mode === "malformed"
            ? { items: [{ id: "bad" }] }
            : {
                items: mode === "duplicate" ? [items[0], items[0]] : items,
                nextCursor: rows.length > start + 25 ? items.at(-1)?.id : undefined,
              },
        ),
      );
    }
    const body = req.postDataJSON();
    moderation.writes.push({ path: u.pathname, body });
    if (moderation.writeMode === "hold")
      await new Promise<void>((r) => {
        moderation.heldWrite = r;
      });
    if (["reject", "throttle"].includes(moderation.writeMode))
      return route.fulfill(fail(moderation.writeMode === "reject" ? 409 : 429));
    const row = moderation.records.find((r) => r.id === u.pathname.split("/").at(-2));
    if (!row) return route.fulfill(fail(404));
    if (row.status !== "PENDING" || row.version !== body.expectedVersion)
      return route.fulfill(fail(409));
    Object.assign(row, {
      status: body.decision,
      moderationNote: body.note ?? null,
      version: row.version + 1,
      moderatedAt: "2026-10-18T10:00:37.123Z",
      updatedAt: "2026-10-18T10:00:37.123Z",
    });
    const safe: Partial<ModerationRecord> = { ...row };
    delete safe.customer;
    delete safe.orderItem;
    delete safe.order;
    delete safe.booking;
    delete safe.vehicleTransaction;
    let data: unknown = safe;
    if (moderation.writeMode === "lost") return route.abort("failed");
    if (moderation.writeMode === "malformed") data = { id: row.id };
    if (moderation.writeMode === "wrong-note")
      data = { ...safe, moderationNote: "Different saved note" };
    if (moderation.writeMode === "wrong-review") data = { ...safe, id: bookingId(999) };
    if (moderation.writeMode === "wrong-source")
      data = { ...safe, productId: bookingId(999) };
    return route.fulfill(ok(data));
  });
  return { ...base, moderation };
}
