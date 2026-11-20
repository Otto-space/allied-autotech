import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { generateOpaqueToken, hashToken } from "../../common/security/session-tokens.js";
import { orderConflict } from "./orders.errors.js";

const uuid = z.uuid();
export const pickupCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9_-]{43}$/);
export const pickupLineSchema = z
  .object({
    orderItemId: uuid,
    quantity: z.number().int().min(1).max(100000),
  })
  .strict();
export const pickupLinesSchema = z
  .array(pickupLineSchema)
  .min(1)
  .max(200)
  .refine(
    (lines) => new Set(lines.map((line) => line.orderItemId)).size === lines.length,
    "Identify each selected order item exactly once",
  );
export type PickupLine = z.infer<typeof pickupLineSchema>;

function unavailable(): never {
  throw orderConflict(
    "Pickup authorisation is invalid or unavailable. Ask the customer to review their private collection access.",
  );
}

/** Hash is domain- and order-bound; never persist or audit the returned raw code.
 * A caller must first authorise the actual ready order and persist the hash in the
 * same transaction as issuance/revocation. This helper grants no access itself. */
export function createPickupSecret(orderId: string, now: Date, expiresAt: Date) {
  uuid.parse(orderId);
  if (
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(expiresAt.getTime()) ||
    expiresAt <= now ||
    expiresAt.getTime() - now.getTime() > 7 * 86400000
  )
    throw orderConflict(
      "Pickup authorisation needs an explicit future expiry within seven days.",
    );
  const pickupCode = generateOpaqueToken(32);
  return {
    pickupCode,
    tokenHash: pickupTokenHash(orderId, pickupCode),
    issuedAt: now,
    expiresAt,
  };
}

export function pickupTokenHash(orderId: string, rawCode: string) {
  const id = uuid.safeParse(orderId),
    code = pickupCodeSchema.safeParse(rawCode);
  if (!id.success || !code.success) unavailable();
  return hashToken("order-pickup", `${id.data.toLowerCase()}:${code.data}`);
}

export type PickupEntitlement = {
  orderId: string;
  tokenHash: string;
  issuedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  consumedAt: Date | null;
};

/** Called only under the parent's Order lock. The durable transaction must also
 * recheck money/branch/readiness, consume exactly once and append the handover. */
export function assertPickupEntitlement(
  entitlement: PickupEntitlement | null,
  orderId: string,
  pickupCode: string,
  now: Date,
) {
  if (
    !entitlement ||
    !Number.isFinite(now.getTime()) ||
    entitlement.orderId.toLowerCase() !== orderId.toLowerCase() ||
    !Number.isFinite(entitlement.issuedAt.getTime()) ||
    !Number.isFinite(entitlement.expiresAt.getTime()) ||
    entitlement.issuedAt > now ||
    entitlement.expiresAt <= now ||
    entitlement.expiresAt <= entitlement.issuedAt ||
    entitlement.revokedAt ||
    entitlement.consumedAt ||
    !/^[0-9a-f]{64}$/.test(entitlement.tokenHash)
  )
    unavailable();
  const supplied = Buffer.from(pickupTokenHash(orderId, pickupCode), "hex"),
    stored = Buffer.from(entitlement.tokenHash, "hex");
  if (supplied.length !== stored.length || !timingSafeEqual(supplied, stored))
    unavailable();
}

/** `collected` is the transaction's grouped totals from immutable handovers, not
 * quantities supplied by a browser. Do not infer physical handover from payment,
 * stock consumption, a READY flag or a public order reference. */
export function remainingPickupQuantities(
  orderLines: PickupLine[],
  collected: PickupLine[],
) {
  const original = pickupLinesSchema.safeParse(orderLines);
  const history = z.array(pickupLineSchema).max(200).safeParse(collected);
  if (
    !original.success ||
    !history.success ||
    new Set(collected.map((line) => line.orderItemId)).size !== collected.length
  )
    throw orderConflict("Collection history needs authorised review before handover.");
  const quantities = new Map(
    original.data.map((line) => [line.orderItemId, line.quantity]),
  );
  for (const line of history.data) {
    const quantity = quantities.get(line.orderItemId);
    if (quantity === undefined || line.quantity > quantity)
      throw orderConflict("Collection history needs authorised review before handover.");
    quantities.set(line.orderItemId, quantity - line.quantity);
  }
  return original.data
    .map((line) => ({
      orderItemId: line.orderItemId,
      quantity: quantities.get(line.orderItemId)!,
    }))
    .filter((line) => line.quantity > 0);
}

/** One code may authorise a selected subset. A partial physical handover consumes
 * that code too: any remainder needs a new private authorisation. Atomicity and
 * replay protection belong to the enclosing durable transaction, not this plan. */
export function planPickupHandover(
  orderLines: PickupLine[],
  collected: PickupLine[],
  authorised: PickupLine[],
  requested: PickupLine[],
) {
  const remaining = remainingPickupQuantities(orderLines, collected);
  const permission = pickupLinesSchema.safeParse(authorised),
    proposed = pickupLinesSchema.safeParse(requested);
  if (!permission.success || !proposed.success)
    throw orderConflict(
      "Choose valid authorised order items and quantities for handover.",
    );
  const available = new Map(remaining.map((line) => [line.orderItemId, line.quantity]));
  const allowed = new Map(
    permission.data.map((line) => [line.orderItemId, line.quantity]),
  );
  const actual = new Map(orderLines.map((line) => [line.orderItemId, line.quantity]));
  if (permission.data.some((line) => line.quantity > (actual.get(line.orderItemId) ?? 0)))
    throw orderConflict("Pickup authorisation does not match this order.");
  for (const line of proposed.data) {
    if (
      line.quantity > (allowed.get(line.orderItemId) ?? 0) ||
      line.quantity > (available.get(line.orderItemId) ?? 0)
    )
      throw orderConflict(
        "The requested handover exceeds the authorised or remaining quantity. Refresh before continuing.",
      );
    available.set(line.orderItemId, available.get(line.orderItemId)! - line.quantity);
  }
  const remainingAfter = remaining
    .map((line) => ({
      orderItemId: line.orderItemId,
      quantity: available.get(line.orderItemId)!,
    }))
    .filter((line) => line.quantity > 0);
  return { lines: proposed.data, remainingAfter, complete: remainingAfter.length === 0 };
}
