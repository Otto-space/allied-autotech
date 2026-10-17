import { z } from "zod";
import {
  inventoryHistorySchema,
  inventoryReservationSchema,
  type Inventory,
} from "@/lib/api/inventory-schemas";
import { workInventorySchema } from "./work-inventory";
import type { MutationProposal } from "@/app/components/mutation-review";

export const movementTypes = [
  "STOCK_IN",
  "SALE",
  "RESERVATION",
  "RESERVATION_RELEASE",
  "RETURN",
  "ADJUSTMENT",
  "DAMAGE",
  "RESTOCK",
] as const;
const movementSchema = inventoryHistorySchema
  .extend({ type: z.enum(movementTypes), createdAt: z.iso.datetime({ offset: true }) })
  .refine(
    (row) =>
      row.quantityBefore >= row.reservedBefore &&
      row.quantityAfter >= row.reservedAfter &&
      row.reservedBefore >= 0 &&
      row.reservedAfter >= 0 &&
      row.quantityAfter - row.quantityBefore === row.quantityDelta &&
      row.reservedAfter - row.reservedBefore === row.reservedDelta,
    "Invalid movement balances",
  );
const reservationSchema = inventoryReservationSchema.extend({
  quantity: z.number().int().positive(),
  expiresAt: z.iso.datetime({ offset: true }),
  createdAt: z.iso.datetime({ offset: true }),
  releasedAt: z.iso.datetime({ offset: true }).nullable(),
  consumedAt: z.iso.datetime({ offset: true }).nullable(),
  expiredAt: z.iso.datetime({ offset: true }).nullable(),
});
export const parseWorkInventoryHistory = (value: unknown) =>
  z
    .object({ items: z.array(movementSchema).max(25), nextCursor: z.uuid().optional() })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate movements",
    )
    .parse(value);
export const parseWorkInventoryReservations = (value: unknown) =>
  z
    .object({
      items: z.array(reservationSchema).max(25),
      nextCursor: z.uuid().optional(),
    })
    .refine(
      (page) => new Set(page.items.map((row) => row.id)).size === page.items.length,
      "Duplicate reservations",
    )
    .parse(value);
export type InventoryOperation = "movement" | "reservation" | "release" | "reorder";
export type InventoryProposal = MutationProposal & {
  operation: InventoryOperation;
  input: Record<string, unknown>;
  reservationId?: string;
};
export function validateInventoryResult(
  response: unknown,
  proposal: InventoryProposal,
  original: Inventory,
) {
  const raw = z.object({ data: z.unknown() }).parse(response).data;
  const result =
    proposal.operation === "reorder"
      ? undefined
      : z
          .object({
            inventory: workInventorySchema,
            replayed: z.boolean(),
            transaction: z.unknown().optional(),
            reservation: z.unknown().optional(),
          })
          .parse(raw);
  const row =
    proposal.operation === "reorder" ? workInventorySchema.parse(raw) : result!.inventory;
  if (
    row.id !== original.id ||
    row.branch.id !== original.branch.id ||
    row.product.id !== original.product.id
  )
    throw Error("Unexpected inventory result");
  const input = proposal.input;
  if (proposal.operation === "reorder") {
    if (
      row.reorderLevel !== input.reorderLevel ||
      row.version !== Number(input.expectedVersion) + 1 ||
      row.quantity !== original.quantity ||
      row.reserved !== original.reserved
    )
      throw Error("Unexpected threshold result");
  } else if (proposal.operation === "reservation") {
    const reservation = reservationSchema.parse(result!.reservation);
    if (
      reservation.quantity !== input.quantity ||
      Date.parse(reservation.expiresAt) !== Date.parse(String(input.expiresAt)) ||
      (reservation.customer?.id ?? null) !== (input.customerId ?? null) ||
      (!result!.replayed && reservation.status !== "ACTIVE")
    )
      throw Error("Unexpected reservation result");
  } else {
    const movement = movementSchema.parse(result!.transaction);
    if (
      !result!.replayed &&
      (row.quantity !== movement.quantityAfter || row.reserved !== movement.reservedAfter)
    )
      throw Error("Unexpected movement result");
    if (proposal.operation === "release") {
      const reservation = reservationSchema.parse(result!.reservation);
      if (
        reservation.id !== proposal.reservationId ||
        !["RELEASED", "EXPIRED"].includes(reservation.status) ||
        movement.type !== "RESERVATION_RELEASE" ||
        movement.quantityDelta !== 0 ||
        movement.reservedDelta !== -reservation.quantity
      )
        throw Error("Unexpected release result");
    } else {
      const delta =
        input.type === "DAMAGE" || input.type === "SALE"
          ? -Number(input.quantity)
          : Number(input.quantity);
      if (
        movement.type !== input.type ||
        (input.type === "ADJUSTMENT"
          ? movement.quantityAfter !== input.targetQuantity
          : movement.quantityDelta !== delta) ||
        (input.type === "SALE" && input.reservationId
          ? movement.reservedDelta !== -Number(input.quantity)
          : movement.reservedDelta !== 0)
      )
        throw Error("Unexpected movement result");
    }
  }
  return row;
}
export const inventorySnapshot = (row: Inventory) => JSON.stringify(row);
export const inventoryPendingKey = (owner: string, id: string) =>
  `inventory-change-pending:${owner}:${id}`;
export function readInventoryPending(key: string) {
  try {
    return !!sessionStorage.getItem(key);
  } catch {
    return true;
  }
}
export function saveInventoryPending(key: string) {
  sessionStorage.setItem(key, "pending");
  if (sessionStorage.getItem(key) !== "pending") throw Error("Pending change not saved");
}
export const clearInventoryPending = (key: string) => sessionStorage.removeItem(key);
