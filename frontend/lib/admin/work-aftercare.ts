import { z } from "zod";
import {
  aftercareOrderSchema,
  matchesAftercareOrder,
  staffAftercareSchema,
  type Aftercare,
  type AftercareOrder,
} from "@/lib/api/aftercare-schemas";
import { ownStaffProfileSchema } from "@/lib/api/capability-schemas";

export const workAftercareOrderSchema = aftercareOrderSchema
  .extend({
    orderNumber: z.string().min(1).max(120),
    createdAt: z.iso.datetime({ offset: true }),
    version: z.number().int().nonnegative(),
  })
  .refine(
    (order) => new Set(order.items.map((item) => item.id)).size === order.items.length,
    "Duplicate order items",
  );
export const parseWorkAftercareOrder = (value: unknown) =>
  workAftercareOrderSchema.parse(value);
export const parseWorkAftercareHistory = (value: unknown) =>
  z
    .array(staffAftercareSchema)
    .max(100)
    .refine(
      (rows) => new Set(rows.map((row) => row.id)).size === rows.length,
      "Duplicate requests",
    )
    .parse(value);
export type WorkAftercareRequest = z.infer<typeof staffAftercareSchema>;
export type WorkAftercareAccess = z.infer<typeof ownStaffProfileSchema>;
export type RunAftercareWrite = (
  operation: (signal: AbortSignal) => Promise<void>,
) => Promise<void>;
export function aftercareStages(record: Aftercare, canDecide: boolean) {
  const stages: ("RECEIVED" | "INSPECTED" | "APPROVED" | "REJECTED")[] = [];
  if (["APPROVED", "REJECTED"].includes(record.status)) return stages;
  if (record.kind === "RETURN" && record.status === "REQUESTED") stages.push("RECEIVED");
  if (record.kind === "RETURN" && record.status === "RECEIVED") stages.push("INSPECTED");
  if (canDecide) {
    if (record.kind === "CANCELLATION" || record.status === "INSPECTED")
      stages.push("APPROVED");
    stages.push("REJECTED");
  }
  return stages;
}
export function aftercarePermission(
  access: WorkAftercareAccess | undefined,
  owner: string,
  role: string,
  order: AftercareOrder | undefined,
) {
  return (
    !!access &&
    access.id === owner &&
    access.role === role &&
    access.status === "ACTIVE" &&
    ["STAFF", "ADMIN", "SUPER_ADMIN"].includes(role) &&
    (role !== "STAFF" ||
      (!!access.staffProfile?.branchId &&
        access.staffProfile.branchId === order?.branch?.id))
  );
}
export function aftercareHistoryMatches(
  rows: Aftercare[] | undefined,
  order: AftercareOrder | undefined,
) {
  return !!rows && !!order && rows.every((row) => matchesAftercareOrder(row, order));
}
export function aftercareSnapshot(
  order: AftercareOrder,
  rows: WorkAftercareRequest[],
  access: WorkAftercareAccess,
) {
  return JSON.stringify({
    order,
    history: [...rows].sort((a, b) => a.id.localeCompare(b.id)),
    access: {
      id: access.id,
      role: access.role,
      status: access.status,
      branchId: access.staffProfile?.branchId ?? null,
      capabilities: [...access.capabilities].sort(),
    },
  });
}
export const aftercarePendingKey = (owner: string, orderId: string) =>
  `work-aftercare-pending:${owner}:${orderId}`;
const pendingSchema = z.discriminatedUnion("operation", [
  z.object({ operation: z.literal("evidence") }).strict(),
  z.object({ operation: z.literal("review"), id: z.uuid() }).strict(),
]);
export type AftercarePending = z.infer<typeof pendingSchema>;
export function readWorkAftercarePending(
  key: string,
): AftercarePending | "unknown" | undefined {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    return pendingSchema.parse(JSON.parse(raw));
  } catch {
    return "unknown";
  }
}
export function saveWorkAftercarePending(key: string, value: AftercarePending) {
  const raw = JSON.stringify(pendingSchema.parse(value));
  sessionStorage.setItem(key, raw);
  if (sessionStorage.getItem(key) !== raw) throw new Error("Pending marker not saved");
}
export function clearWorkAftercarePending(key: string) {
  sessionStorage.removeItem(key);
}
