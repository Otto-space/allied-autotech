import { complaintSettingsSchema } from "@/lib/api/operational-policy-schemas";
import { z } from "zod";
import { policyVersionSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
const complaintVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "complaints", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    current: complaintVersion.nullable(),
    latest: complaintVersion.nullable(),
    nextScheduled: complaintVersion.nullable(),
    history: z.array(complaintVersion).max(100),
  })
  .strict();
export type ComplaintWorkspace = z.infer<typeof workspace>;
export function parseComplaintWorkspace(value: unknown): ComplaintWorkspace {
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
    throw Error("Unexpected complaint policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected complaint policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory complaint policy selection");
  }
  return result;
}
export function validateComplaintReceipt(
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
  const row = complaintVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q11" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(complaintSettingsSchema.strict().parse(row.settings)) !==
      JSON.stringify(complaintSettingsSchema.strict().parse(body.settings))
  )
    throw Error("Unexpected complaint policy receipt");
  return row;
}
