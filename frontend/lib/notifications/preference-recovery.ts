import { z } from "zod";
import { preferenceWriteBodySchema } from "../api/notification-schemas";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:notification-write:v1:";
const slot = (owner: string) => `${prefix}${owner}:preferences`;
export const preferenceKeySchema = z
  .string()
  .regex(
    /^preference-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const intentSchema = z
  .object({
    owner: z.uuid(),
    role: z.enum(["CUSTOMER", "STAFF", "ADMIN", "SUPER_ADMIN"]),
    key: preferenceKeySchema,
    body: preferenceWriteBodySchema,
  })
  .strict();
export type PreferenceIntent = z.infer<typeof intentSchema>;
export type PreferenceRecovery =
  | { kind: "pending"; intent: PreferenceIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
export function preferenceIntentActive(intent: PreferenceIntent, now = Date.now()) {
  const issued = Number(intent.key.split(".")[1]);
  return now >= issued && now < issued + 24 * 60 * 60 * 1000;
}
export function readPreferenceRecovery(owner: string): PreferenceRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(slot(owner));
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return;
  try {
    if (raw.length > 20000) return { kind: "history" };
    const value = intentSchema.parse(JSON.parse(raw));
    if (value.owner !== owner || !preferenceIntentActive(value))
      return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function savePreferenceRecovery(value: PreferenceIntent) {
  const intent = intentSchema.parse(value);
  if (draftIdentity() !== `${intent.owner}:${intent.role}`)
    throw new Error("Preference draft account changed");
  const raw = JSON.stringify(intent);
  sessionStorage.setItem(slot(intent.owner), raw);
  if (sessionStorage.getItem(slot(intent.owner)) !== raw)
    throw new Error("Preference recovery storage unavailable");
}
export function clearPreferenceRecovery(owner: string) {
  sessionStorage.removeItem(slot(owner));
}
export function redactPreferenceRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix) && key.endsWith(":preferences"))
        sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain uncertainty if storage is unavailable. */
  }
}
