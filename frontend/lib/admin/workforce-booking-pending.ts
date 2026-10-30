import { z } from "zod";
import { draftIdentity } from "../forms/drafts";
type BookingAction = "confirm" | "alternative";
const prefix = (action: BookingAction) => `aat:workforce-booking-${action}:v1:`;
const schema = z
  .object({ token: z.uuid(), id: z.uuid(), version: z.number().int().nonnegative() })
  .strict();
export type WorkforceBookingPending = z.infer<typeof schema> | "unknown";
function identity(owner: string) {
  if (!draftIdentity()?.startsWith(`${owner}:`))
    throw Error("The acting account changed.");
}
export function readWorkforceBookingPending(
  owner: string,
  action: BookingAction = "confirm",
): WorkforceBookingPending | undefined {
  if (typeof window === "undefined") return;
  try {
    const raw = sessionStorage.getItem(prefix(action) + owner);
    return raw === null ? undefined : schema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markWorkforceBookingPending(
  owner: string,
  id: string,
  version: number,
  action: BookingAction = "confirm",
) {
  identity(owner);
  if (readWorkforceBookingPending(owner, action))
    throw Error("An earlier booking change still needs checking.");
  const marker = schema.parse({ token: crypto.randomUUID(), id, version });
  const raw = JSON.stringify(marker);
  sessionStorage.setItem(prefix(action) + owner, raw);
  if (sessionStorage.getItem(prefix(action) + owner) !== raw)
    throw Error("Booking recovery storage is unavailable.");
  return marker;
}
export function clearWorkforceBookingPending(
  owner: string,
  token?: string,
  action: BookingAction = "confirm",
) {
  identity(owner);
  const current = readWorkforceBookingPending(owner, action);
  if (token && (current === "unknown" || current?.token !== token))
    throw Error("The pending booking reference changed.");
  sessionStorage.removeItem(prefix(action) + owner);
  if (sessionStorage.getItem(prefix(action) + owner) !== null)
    throw Error("Booking recovery storage is unavailable.");
}
export function redactWorkforceBookingPending() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix("confirm")) || key.startsWith(prefix("alternative")))
        sessionStorage.setItem(key, "pending");
  } catch {}
}
