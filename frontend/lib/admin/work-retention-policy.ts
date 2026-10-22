import { retentionSettingsSchema } from "@/lib/api/operational-policy-schemas";
import { z } from "zod";
import { policyVersionSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
const exactSettings = retentionSettingsSchema
  .extend({
    records: retentionSettingsSchema.shape.records.element
      .strict()
      .array()
      .min(1)
      .max(20),
  })
  .strict();
const retentionVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "retention", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    current: retentionVersion.nullable(),
    latest: retentionVersion.nullable(),
    nextScheduled: retentionVersion.nullable(),
    history: z.array(retentionVersion).max(100),
  })
  .strict();
export type RetentionWorkspace = z.infer<typeof workspace>;
export function parseRetentionWorkspace(value: unknown): RetentionWorkspace {
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
    throw Error("Unexpected retention policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected retention policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory retention policy selection");
  }
  return result;
}
export function validateRetentionReceipt(
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
  const row = retentionVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q13" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(exactSettings.parse(row.settings)) !==
      JSON.stringify(exactSettings.parse(body.settings))
  )
    throw Error("Unexpected retention policy receipt");
  return row;
}
