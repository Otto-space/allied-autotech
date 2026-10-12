import { z } from "zod";
import { aftercareRequestSchema } from "../api/aftercare-schemas";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:aftercare-create:v1:";
export const aftercareKeySchema = z
  .string()
  .regex(
    /^aftercare-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
export const aftercareIntentSchema = z
  .object({
    owner: z.uuid(),
    key: aftercareKeySchema,
    orderId: z.uuid(),
    operation: z.enum(["returns", "aftercare"]),
    body: z.union([
      aftercareRequestSchema.strict(),
      z.object({ reason: z.string().trim().min(10).max(2000) }).strict(),
    ]),
  })
  .strict()
  .refine((v) => (v.operation === "aftercare" ? "kind" in v.body : !("kind" in v.body)));
export type AftercareIntent = z.infer<typeof aftercareIntentSchema>;
export type AftercareRecovery =
  | { kind: "pending"; intent: AftercareIntent }
  | { kind: "history" }
  | { kind: "unavailable" };
export function aftercareIntentActive(intent: AftercareIntent, now = Date.now()) {
  const issued = Number(intent.key.split(".")[1]);
  return now >= issued && now < issued + 24 * 60 * 60 * 1000;
}
export function readAftercareRecovery(
  owner: string,
  orderId: string,
): AftercareRecovery | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(`${prefix}${owner}:${orderId}`);
  } catch {
    return { kind: "unavailable" };
  }
  if (raw === null) return;
  try {
    if (raw.length > 20000) return { kind: "history" };
    const value = aftercareIntentSchema.parse(JSON.parse(raw));
    if (
      value.owner !== owner ||
      value.orderId !== orderId ||
      !aftercareIntentActive(value)
    )
      return { kind: "history" };
    return { kind: "pending", intent: value };
  } catch {
    return { kind: "history" };
  }
}
export function saveAftercareRecovery(value: AftercareIntent) {
  const intent = aftercareIntentSchema.parse(value);
  if (draftIdentity() !== `${intent.owner}:CUSTOMER`)
    throw new Error("Aftercare draft account changed");
  const raw = JSON.stringify(intent);
  sessionStorage.setItem(`${prefix}${intent.owner}:${intent.orderId}`, raw);
  if (sessionStorage.getItem(`${prefix}${intent.owner}:${intent.orderId}`) !== raw)
    throw new Error("Aftercare recovery storage unavailable");
}
export function clearAftercareRecovery(owner: string, orderId: string) {
  sessionStorage.removeItem(`${prefix}${owner}:${orderId}`);
}
export function redactAftercareRecoveries() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Retain uncertainty if storage is unavailable. */
  }
}
