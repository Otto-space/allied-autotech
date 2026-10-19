import type { Page } from "@playwright/test";
import { parseSaleDetail } from "@/lib/admin/work-vehicle-sale-detail";
import { workVehicleSalesFixture, salesRecord, bookingId } from "./work-vehicle-sales";
export { bookingId };
export async function workSaleDetailFixture(page: Page, role = "ADMIN") {
  const base = await workVehicleSalesFixture(page, role),
    state = {
      record: parseSaleDetail(
        salesRecord(),
        bookingId(10000),
        role,
        role === "STAFF" ? bookingId(101) : undefined,
      ),
      mode: "normal",
      writeMode: "normal",
      reads: 0,
      writes: [] as { path: string; body: Record<string, unknown> }[],
      accessReads: 0,
      held: undefined as (() => void) | undefined,
    };
  const ok = (data: unknown) => ({
    json: {
      success: true,
      data,
      message: "Synthetic detail",
      meta: { requestId: "sale-detail-quality" },
    },
  });
  await page.route("**/api/v1/auth/csrf", (route) =>
    route.fulfill(ok({ csrfToken: "synthetic-sale-detail-token-".repeat(3) })),
  );
  await page.route("**/api/v1/staff/vehicle-transactions/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (req.method() === "GET") {
      state.reads++;
      if (state.mode === "hold")
        await new Promise<void>((resolve) => {
          state.held = resolve;
        });
      if (["error", "denied", "missing"].includes(state.mode))
        return route.fulfill({
          status: state.mode === "error" ? 503 : state.mode === "missing" ? 404 : 403,
          json: {
            success: false,
            error: {
              code: state.mode === "error" ? "DATABASE_UNAVAILABLE" : "NOT_FOUND",
            },
          },
        });
      if (state.mode === "malformed") return route.fulfill(ok({ id: state.record.id }));
      return route.fulfill(
        ok(
          state.mode === "mismatch"
            ? { ...state.record, id: bookingId(999) }
            : state.record,
        ),
      );
    }
    if (path.endsWith("/access")) {
      state.accessReads++;
      return route.fulfill(
        ok({
          url: "https://storage.invalid/download/handover?signature=synthetic",
          expiresInSeconds: 60,
        }),
      );
    }
    const body = req.postDataJSON();
    state.writes.push({ path, body });
    if (state.writeMode === "hold")
      await new Promise<void>((resolve) => {
        state.held = resolve;
      });
    if (["reject", "throttle"].includes(state.writeMode))
      return route.fulfill({
        status: state.writeMode === "reject" ? 409 : 429,
        json: { success: false, error: { code: "STALE_VERSION" } },
      });
    const previous = state.record.status,
      stamp = "2026-10-17T10:00:37.123Z",
      history = (reason: unknown) =>
        state.record.statusHistory.push({
          id: bookingId(20000 + state.writes.length),
          fromStatus: previous,
          toStatus: state.record.status,
          reason: typeof reason === "string" ? reason : null,
          createdAt: stamp,
        });
    if (path.endsWith("/negotiate")) {
      state.record.version++;
      state.record.status = "NEGOTIATING";
      state.record.agreedPriceKobo = String(body.agreedPriceKobo);
      state.record.reservationRequiredKobo =
        body.reservationRequiredKobo === null
          ? null
          : String(body.reservationRequiredKobo);
      history(body.notes);
    } else if (path.endsWith("/handovers")) {
      state.record.version++;
      state.record.status = "HANDOVER_PENDING";
      state.record.handoverPendingAt = stamp;
      state.record.handover = {
        id: bookingId(21000),
        status: "PENDING",
        hasSignedDocument: Boolean(body.assetToken),
        version: 0,
        recipientName: String(body.recipientName),
        recipientPhone: String(body.recipientPhone),
        odometerKm: Number(body.odometerKm),
        keysDelivered: Number(body.keysDelivered),
        readyAt: null,
        completedAt: null,
        cancelledAt: null,
        createdAt: stamp,
      };
      history(undefined);
    } else if (path.includes("/handovers/")) {
      const handover = state.record.handover!;
      handover.version++;
      handover.status = body.status as typeof handover.status;
      if (body.status === "READY") handover.readyAt = stamp;
      else if (body.status === "CANCELLED") handover.cancelledAt = stamp;
      else {
        handover.completedAt = stamp;
        state.record.status = "COMPLETED";
        state.record.version++;
        state.record.completedAt = stamp;
        state.record.vehicleListing.status = "SOLD";
        history(undefined);
      }
    } else {
      state.record.version++;
      state.record.status = body.status as typeof state.record.status;
      if (body.status === "CANCELLED") {
        state.record.cancellationReason = String(body.reason);
        state.record.cancelledAt = stamp;
      }
      history(body.reason);
    }
    if (state.writeMode === "lost") return route.abort("failed");
    if (state.writeMode === "malformed")
      return route.fulfill(ok({ id: state.record.id }));
    if (state.writeMode === "mismatch")
      return route.fulfill(ok({ ...state.record, version: state.record.version + 1 }));
    return route.fulfill({
      ...ok(state.record),
      status: path.endsWith("/handovers") ? 201 : 200,
    });
  });
  return { ...base, detail: state };
}
