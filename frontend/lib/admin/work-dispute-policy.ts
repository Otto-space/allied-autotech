import { disputeSettingsSchema } from "@/lib/api/operational-policy-schemas";
import { z } from "zod";
import { policyVersionSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
const disputeVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "disputes", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    current: disputeVersion.nullable(),
    latest: disputeVersion.nullable(),
    nextScheduled: disputeVersion.nullable(),
    history: z.array(disputeVersion).max(100),
  })
  .strict();
export type DisputeWorkspace = z.infer<typeof workspace>;
export function parseDisputeWorkspace(value: unknown): DisputeWorkspace {
  const result = workspace.parse(value),
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
    throw Error("Unexpected dispute policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected dispute policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory dispute policy selection");
  }
  return result;
}
export function validateDisputeReceipt(
  value: unknown,
  body: {
    expectedVersion: number;
    effectiveAt: string;
    source: string;
    approvalEvidence: string;
    settings: unknown;
  },
  actor: string,
): PolicyVersion {
  const row = disputeVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q9" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(disputeSettingsSchema.strict().parse(row.settings)) !==
      JSON.stringify(disputeSettingsSchema.strict().parse(body.settings))
  )
    throw Error("Unexpected dispute policy receipt");
  return row;
}
