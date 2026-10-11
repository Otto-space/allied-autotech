import { z } from "zod";

const PREFIX = "aat:vehicle-request:v1:";
// Stop slightly before the server's 24-hour minimum retention window.
const RETRY_WINDOW = 23 * 60 * 60 * 1000;
const body = z.object({ vehicleListingId: z.uuid() });
const intentSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("enquire"),
      body: body.strict(),
      owner: z.uuid(),
      key: z.uuid(),
      startedAt: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("inspect"),
      body: body
        .extend({
          preferredStartAt: z.iso.datetime(),
          notes: z.string().max(2000).optional(),
        })
        .strict(),
      owner: z.uuid(),
      key: z.uuid(),
      startedAt: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type VehicleCreationIntent = z.infer<typeof intentSchema>;
export type VehicleCreationAction = VehicleCreationIntent["action"];
export type VehicleRetry =
  | { kind: "pending"; intent: VehicleCreationIntent }
  | { kind: "history" }
  | { kind: "unavailable" };

function slot(owner: string, listingId: string, action: VehicleCreationAction) {
  return `${PREFIX}${owner}:${listingId}:${action}`;
}

export function canRetryVehicleCreation(intent: VehicleCreationIntent, now = Date.now()) {
  return now >= intent.startedAt && now - intent.startedAt < RETRY_WINDOW;
}

export function readVehicleRetry(
  owner: string,
  listingId: string,
  action: VehicleCreationAction,
): VehicleRetry | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(slot(owner, listingId, action));
  } catch {
    return { kind: "unavailable" };
  }
  try {
    if (raw === null) return undefined;
    if (raw.length > 16000) return { kind: "history" };
    const parsed = intentSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.owner !== owner ||
      parsed.data.action !== action ||
      parsed.data.body.vehicleListingId !== listingId ||
      !canRetryVehicleCreation(parsed.data)
    )
      return { kind: "history" };
    return { kind: "pending", intent: parsed.data };
  } catch {
    // Unreadable storage must never silently become permission for a new attempt.
    return { kind: "history" };
  }
}

export function saveVehicleRetry(intent: VehicleCreationIntent): void {
  const value = intentSchema.parse(intent);
  sessionStorage.setItem(
    slot(value.owner, value.body.vehicleListingId, value.action),
    JSON.stringify(value),
  );
}

export function clearVehicleRetry(
  owner: string,
  listingId: string,
  action: VehicleCreationAction,
): boolean {
  try {
    sessionStorage.removeItem(slot(owner, listingId, action));
    return true;
  } catch {
    return false;
  }
}

// Remove reviewed notes on sign-out/account changes, but keep a non-sensitive
// marker so returning to that account cannot silently start a duplicate request.
export function redactVehicleRetries(): void {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(PREFIX)) sessionStorage.setItem(key, '{"history":true}');
    }
  } catch {
    /* Storage may be disabled by the browser. */
  }
}
