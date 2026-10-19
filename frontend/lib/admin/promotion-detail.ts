import { z } from "zod";
import { workPromotionSchema } from "./work-promotions";
import { draftIdentity } from "../forms/drafts";
export const promotionDetailSchema = workPromotionSchema.safeExtend({
  description: z.string().max(2000).nullable(),
  version: z.number().int().min(0).max(2_147_483_647),
  usageLimit: z.number().int().min(1).max(10_000_000).nullable(),
  perCustomerLimit: z.number().int().min(1).max(100_000).nullable(),
});
export function parsePromotionDetail(value: unknown, id: string) {
  const row = promotionDetailSchema.parse(value);
  if (row.id !== id) throw Error("Unexpected promotion record");
  return row;
}
export const promotionSnapshot = (value: z.infer<typeof promotionDetailSchema>) =>
  JSON.stringify(value);
export const pendingPromotionKey = (owner: string, role: string, id: string) =>
  `aat:promotion-edit:v1:${owner}:${role}:${id}`;
const pendingSchema = z
  .object({ version: z.number().int().min(0).max(2_147_483_647) })
  .strict();
export type PendingPromotion = z.infer<typeof pendingSchema> | "unknown";
export function readPromotionPending(key: string): PendingPromotion | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return;
    if (raw.length > 100) return "unknown";
    return pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function markPromotionPending(
  owner: string,
  role: string,
  id: string,
  version: number,
) {
  if (draftIdentity() !== `${owner}:${role}` || !["ADMIN", "SUPER_ADMIN"].includes(role))
    throw Error("Promotion account changed");
  const key = pendingPromotionKey(owner, role, id),
    raw = JSON.stringify(pendingSchema.parse({ version }));
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw)
    throw Error("Promotion recovery storage unavailable");
}
export function clearPromotionPending(key: string) {
  sessionStorage.removeItem(key);
}
