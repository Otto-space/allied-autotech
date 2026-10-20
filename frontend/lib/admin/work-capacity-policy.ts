import { capacitySettingsSchema } from "@/lib/api/policy-schemas";
import { z } from "zod";
import { policyVersionSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
const exactSettings = capacitySettingsSchema.strict();
const capacityVersion = (branchId: string) =>
  policyVersionSchema
    .strict()
    .refine((v) => v.key === `booking-capacity:${branchId}`, "Unexpected policy key");
const workspace = (branchId: string) =>
  z
    .object({
      evaluatedAt: z.iso.datetime({ offset: true }),
      branch: z
        .object({
          id: z.uuid(),
          name: z.string().min(1),
          isActive: z.boolean(),
          updatedAt: z.iso.datetime({ offset: true }),
        })
        .strict()
        .refine((b) => b.id === branchId),
      current: capacityVersion(branchId).nullable(),
      latest: capacityVersion(branchId).nullable(),
      nextScheduled: capacityVersion(branchId).nullable(),
      history: z.array(capacityVersion(branchId)).max(100),
    })
    .strict();
export type CapacityWorkspace = z.infer<ReturnType<typeof workspace>>;
export function parseCapacityWorkspace(
  value: unknown,
  branchId: string,
): CapacityWorkspace {
  const result = workspace(branchId).parse(value),
    now = Date.parse(result.evaluatedAt);
  const { current, latest, nextScheduled, history } = result;
  if (
    (history.length === 0) !== (latest === null) ||
    (latest && JSON.stringify(latest) !== JSON.stringify(history[0])) ||
    new Set(history.map((v) => v.id)).size !== history.length ||
    history.some((v, i) => i > 0 && v.version >= history[i - 1]!.version) ||
    (current &&
      (Date.parse(current.effectiveAt) > now ||
        !latest ||
        current.version > latest.version)) ||
    (nextScheduled &&
      (Date.parse(nextScheduled.effectiveAt) <= now ||
        !latest ||
        nextScheduled.version > latest.version))
  )
    throw Error("Unexpected capacity policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected capacity policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory capacity policy selection");
  }
  return result;
}
export function validateCapacityReceipt(
  value: unknown,
  body: {
    branchId: string;
    expectedVersion: number;
    effectiveAt: string;
    source: string;
    approvalEvidence: string;
    settings: unknown;
  },
  actor: string,
): PolicyVersion {
  const row = capacityVersion(body.branchId).parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q5" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(exactSettings.parse(row.settings)) !==
      JSON.stringify(exactSettings.parse(body.settings))
  )
    throw Error("Unexpected capacity policy receipt");
  return row;
}
