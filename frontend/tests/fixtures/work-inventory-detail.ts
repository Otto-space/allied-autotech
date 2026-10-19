import type { Page } from "@playwright/test";
import type { z } from "zod";
import type { inventoryHistorySchema } from "@/lib/api/inventory-schemas";
import type { InventoryReservation } from "@/lib/api/inventory-schemas";
import { workInventoryFixture, stockRecord, bookingId } from "./work-inventory";
export { bookingId };
export function stockReservation(n = 0): InventoryReservation {
  return {
    id: bookingId(5000 + n),
    quantity: 2,
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: "2026-10-17T08:00:00.000Z",
    releasedAt: null,
    consumedAt: null,
    expiredAt: null,
    referenceType: "MANUAL",
    referenceId: "QA-HOLD",
    customer: null,
  };
}
const initialMovement = (): z.infer<typeof inventoryHistorySchema> => ({
  id: bookingId(5100),
  type: "STOCK_IN",
  quantityDelta: 10,
  reservedDelta: 0,
  quantityBefore: 0,
  quantityAfter: 10,
  reservedBefore: 0,
  reservedAfter: 0,
  referenceType: "MANUAL",
  referenceId: "QA-RECEIPT",
  note: "Synthetic initial stock receipt",
  createdAt: "2026-10-17T08:00:00.000Z",
  performedBy: null,
});
export async function workInventoryDetailFixture(page: Page, role = "ADMIN") {
  const base = await workInventoryFixture(page, role),
    state = {
      record: stockRecord(),
      mode: "normal",
      outcome: "success",
      historyMode: "normal",
      reservationMode: "normal",
      history: [initialMovement()],
      reservations: [stockReservation()],
      reads: [] as string[],
      writes: [] as {
        path: string;
        body: Record<string, unknown>;
        key?: string;
        csrf?: string;
      }[],
    };
  const receipts = new Map<string, unknown>();
  await page.route("**/api/v1/staff/inventory/**", async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname.replace("/api/v1", "");
    const ok = (data: unknown) =>
      route.fulfill({
        json: {
          success: true,
          data,
          message: "Synthetic inventory detail",
          meta: { requestId: "inventory-detail-qa" },
        },
      });
    const fail = (status: number, code: string) =>
      route.fulfill({ status, json: { success: false, error: { code } } });
    if (req.method() === "GET") {
      state.reads.push(path);
      const mode = path.endsWith("/history")
        ? state.historyMode
        : path.endsWith("/reservations")
          ? state.reservationMode
          : state.mode;
      if (["error", "denied"].includes(mode))
        return fail(
          mode === "error" ? 503 : 403,
          mode === "error" ? "DATABASE_UNAVAILABLE" : "FORBIDDEN",
        );
      if (mode === "malformed") return ok({ id: "bad" });
      if (path.endsWith("/history")) {
        const type = url.searchParams.get("type");
        return ok({
          items:
            mode === "empty"
              ? []
              : state.history.filter((row) => !type || row.type === type),
        });
      }
      if (path.endsWith("/reservations")) {
        const status = url.searchParams.get("status");
        return ok({
          items:
            mode === "empty"
              ? []
              : state.reservations.filter((row) => !status || row.status === status),
        });
      }
      return ok(
        mode === "mismatch" ? { ...state.record, id: bookingId(9999) } : state.record,
      );
    }
    const body = req.postDataJSON() as Record<string, unknown>,
      key = req.headers()["idempotency-key"];
    state.writes.push({ path, body, key, csrf: req.headers()["x-csrf-token"] });
    if (state.outcome === "reject") return fail(409, "CONFLICT");
    if (state.outcome === "throttled") return fail(429, "RATE_LIMITED");
    if (key && receipts.has(key))
      return ok({
        ...(receipts.get(key) as object),
        inventory: state.record,
        replayed: true,
      });
    const previous = { ...state.record };
    let data: unknown;
    if (req.method() === "PATCH") {
      if (body.expectedVersion !== state.record.version) return fail(409, "CONFLICT");
      if (state.outcome !== "uncommitted")
        state.record = {
          ...state.record,
          reorderLevel: Number(body.reorderLevel),
          version: state.record.version + 1,
          updatedAt: new Date().toISOString(),
        };
      data = state.record;
    } else {
      let reservation: InventoryReservation | undefined,
        type = String(body.type),
        quantityDelta = 0,
        reservedDelta = 0;
      if (path.endsWith("/reservations")) {
        type = "RESERVATION";
        reservedDelta = Number(body.quantity);
        reservation = {
          ...stockReservation(state.reservations.length),
          quantity: reservedDelta,
          expiresAt: String(body.expiresAt),
          referenceType: body.referenceType ? String(body.referenceType) : null,
          referenceId: body.referenceId ? String(body.referenceId) : null,
          customer: body.customerId ? { id: String(body.customerId) } : null,
        };
      } else if (path.endsWith("/release")) {
        type = "RESERVATION_RELEASE";
        const id = path.split("/").at(-2);
        reservation = state.reservations.find((row) => row.id === id);
        if (!reservation || reservation.status !== "ACTIVE") return fail(409, "CONFLICT");
        reservedDelta = -reservation.quantity;
        reservation = {
          ...reservation,
          status:
            Date.parse(reservation.expiresAt) <= Date.now() ? "EXPIRED" : "RELEASED",
          releasedAt: new Date().toISOString(),
        };
      } else {
        quantityDelta =
          body.type === "ADJUSTMENT"
            ? Number(body.targetQuantity) - state.record.quantity
            : ["SALE", "DAMAGE"].includes(type)
              ? -Number(body.quantity)
              : Number(body.quantity);
        if (body.reservationId) {
          reservation = state.reservations.find((row) => row.id === body.reservationId);
          if (
            !reservation ||
            reservation.status !== "ACTIVE" ||
            Date.parse(reservation.expiresAt) <= Date.now()
          )
            return fail(409, "CONFLICT");
          reservedDelta = -Number(body.quantity);
          reservation = {
            ...reservation,
            status: "CONSUMED",
            consumedAt: new Date().toISOString(),
          };
        }
      }
      const saved = {
        ...state.record,
        quantity: state.record.quantity + quantityDelta,
        reserved: state.record.reserved + reservedDelta,
        available: state.record.available + quantityDelta - reservedDelta,
        version: state.record.version + 1,
        updatedAt: new Date().toISOString(),
      };
      if (saved.quantity < saved.reserved || saved.reserved < 0)
        return fail(409, "INSUFFICIENT_STOCK");
      const transaction = {
        ...initialMovement(),
        id: bookingId(5200 + state.history.length),
        type,
        quantityBefore: previous.quantity,
        quantityAfter: saved.quantity,
        reservedBefore: previous.reserved,
        reservedAfter: saved.reserved,
        quantityDelta,
        reservedDelta,
        note: body.note ? String(body.note) : null,
      };
      data = { inventory: saved, transaction, reservation, replayed: false };
      if (state.outcome !== "uncommitted") {
        state.record = saved;
        state.history.unshift(transaction);
        if (reservation) {
          const index = state.reservations.findIndex((row) => row.id === reservation!.id);
          if (index >= 0) state.reservations[index] = reservation;
          else state.reservations.unshift(reservation);
        }
      }
    }
    if (state.outcome !== "uncommitted" && key) receipts.set(key, data);
    if (["uncertain", "uncommitted"].includes(state.outcome))
      return route.abort("failed");
    if (state.outcome === "contradictory")
      return ok(
        req.method() === "PATCH"
          ? { ...state.record, id: bookingId(9999) }
          : { ...(data as object), inventory: { ...state.record, id: bookingId(9999) } },
      );
    return ok(data);
  });
  return { state, base };
}
