import { z } from "zod";
import { channelPendingSchema, channelRecoveryOwner } from "./channel-pending";
const prefix = "aat:care-coverage:v1:";
const ownerSchema = z.string().regex(/^[a-f0-9]{64}$/);
const markerSchema = z.strictObject({
  operationKey: channelPendingSchema.shape.operationKey,
});
export type CoveragePending = z.infer<typeof markerSchema>;
export const coverageRecoveryOwner = (userId: string, branchId: string) =>
  channelRecoveryOwner(userId, "SUPER_ADMIN", "support-coverage", branchId);
export function readCoveragePending(owner: string) {
  const raw = sessionStorage.getItem(prefix + ownerSchema.parse(owner));
  return raw === null ? null : markerSchema.parse(JSON.parse(raw));
}
export function saveCoveragePending(owner: string, marker: CoveragePending) {
  sessionStorage.setItem(
    prefix + ownerSchema.parse(owner),
    JSON.stringify(markerSchema.parse(marker)),
  );
}
export function clearCoveragePending(owner: string) {
  sessionStorage.removeItem(prefix + ownerSchema.parse(owner));
}
export function redactCoveragePending() {
  if (typeof sessionStorage === "undefined") return;
  try {
    for (const name of Object.keys(sessionStorage))
      if (name.startsWith(prefix)) sessionStorage.removeItem(name);
  } catch {
    /* Current identity is invalidated independently. */
  }
}
