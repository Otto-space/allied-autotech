import { z } from "zod";
import {
  policyVersionSchema,
  financeSettingsSchema,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";
const financeVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "finance", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    current: financeVersion.nullable(),
    latest: financeVersion.nullable(),
    nextScheduled: financeVersion.nullable(),
    history: z.array(financeVersion).max(100),
  })
  .strict();
export type FinanceWorkspace = z.infer<typeof workspace>;
export function parseFinanceWorkspace(value: unknown): FinanceWorkspace {
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
    throw Error("Unexpected financial policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected financial policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory financial policy selection");
  }
  return result;
}
export function validateFinanceReceipt(
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
  const row = financeVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q7-Q8" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(financeSettingsSchema.strict().parse(row.settings)) !==
      JSON.stringify(financeSettingsSchema.strict().parse(body.settings))
  )
    throw Error("Unexpected financial policy receipt");
  return row;
}
