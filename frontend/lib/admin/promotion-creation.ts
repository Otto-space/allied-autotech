import { z } from "zod";
import { promotionFormSchema, type PromotionValues } from "../forms/promotion";
import { draftIdentity } from "../forms/drafts";

const prefix = "aat:promotion-create:v1:";
export const promotionCreationKeySchema = z
  .string()
  .regex(
    /^promotion-v1\.\d{13}\.[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
const identity = {
  owner: z.uuid(),
  role: z.enum(["ADMIN", "SUPER_ADMIN"]),
  key: promotionCreationKeySchema,
};
const pendingSchema = z
  .object({ ...identity, kind: z.literal("pending"), values: promotionFormSchema })
  .strict();
const confirmedSchema = z
  .object({ ...identity, kind: z.literal("confirmed"), promotionId: z.uuid() })
  .strict();
export const promotionCreationSchema = z.discriminatedUnion("kind", [
  pendingSchema,
  confirmedSchema,
]);
export type PromotionCreationIntent = z.infer<typeof pendingSchema>;
export type PromotionCreationState =
  z.infer<typeof promotionCreationSchema> | "history" | "unavailable";
const storageKey = (owner: string, role: string) => `${prefix}${owner}:${role}`;
export function promotionCreationActive(key: string, now = Date.now()) {
  const issued = Number(key.split(".")[1]);
  return (
    promotionCreationKeySchema.safeParse(key).success &&
    issued <= now + 60_000 &&
    now < issued + 86_400_000
  );
}
export function newPromotionCreation(
  owner: string,
  role: string,
  values: PromotionValues,
): PromotionCreationIntent {
  return pendingSchema.parse({
    owner,
    role,
    values,
    kind: "pending",
    key: `promotion-v1.${Date.now()}.${crypto.randomUUID()}`,
  });
}
export function readPromotionCreation(
  owner: string,
  role: string,
): PromotionCreationState | undefined {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(storageKey(owner, role));
  } catch {
    return "unavailable";
  }
  if (raw === null) return;
  try {
    if (raw.length > 24_000) return "history";
    const state = promotionCreationSchema.parse(JSON.parse(raw));
    if (state.owner !== owner || state.role !== role) return "history";
    return state;
  } catch {
    return "history";
  }
}
export function savePromotionCreation(value: z.infer<typeof promotionCreationSchema>) {
  const state = promotionCreationSchema.parse(value);
  if (draftIdentity() !== `${state.owner}:${state.role}`)
    throw Error("Promotion account changed");
  const raw = JSON.stringify(state),
    key = storageKey(state.owner, state.role);
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Promotion recovery storage unavailable");
}
export function clearPromotionCreation(owner: string, role: string) {
  sessionStorage.removeItem(storageKey(owner, role));
}
export function redactPromotionCreations() {
  if (typeof window === "undefined") return;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.setItem(key, "pending");
  } catch {
    /* Preserve the lock if storage is unavailable. */
  }
}
export function parsePromotionReceipt(value: unknown, key: string) {
  const receipt = z
    .object({ key: promotionCreationKeySchema, promotionId: z.uuid().nullable() })
    .strict()
    .parse(value);
  if (receipt.key !== key) throw Error("Unexpected promotion creation receipt");
  return receipt;
}
