import { createHash } from "node:crypto";
import type { PaymentCreateInput } from "./payments.schemas.js";

export function paymentJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(paymentJsonSafe);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, paymentJsonSafe(child)]),
    );
  return value;
}
export function paymentFingerprint(input: PaymentCreateInput): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export function paymentPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return { items, ...(rows.length > limit && last ? { nextCursor: last.id } : {}) };
}
