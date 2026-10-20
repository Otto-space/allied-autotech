import { z } from "zod";
import {
  bankRefundClockSettingsSchema,
  policyVersionSchema,
  type PolicyVersion,
} from "@/lib/api/policy-schemas";

const exactSettings = bankRefundClockSettingsSchema.strict();
const refundVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "bank_refund_clock", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    current: refundVersion.nullable(),
    latest: refundVersion.nullable(),
    nextScheduled: refundVersion.nullable(),
    history: z.array(refundVersion).max(100),
  })
  .strict();
export type RefundTimingWorkspace = z.infer<typeof workspace>;
export function parseRefundTimingWorkspace(value: unknown): RefundTimingWorkspace {
  const result = workspace.parse(value),
    now = Date.parse(result.evaluatedAt);
  const { current, latest, nextScheduled, history } = result;
  if (
    (history.length === 0) !== (latest === null) ||
    (latest && JSON.stringify(latest) !== JSON.stringify(history[0])) ||
    new Set(history.map((v) => v.id)).size !== history.length ||
    history.some((v, i) => i > 0 && v.version >= history[i - 1]!.version) ||
    (current &&
      (current.approvalStatus !== "APPROVED" ||
        Date.parse(current.effectiveAt) > now ||
        !latest ||
        current.version > latest.version)) ||
    (nextScheduled &&
      (nextScheduled.approvalStatus !== "APPROVED" ||
        Date.parse(nextScheduled.effectiveAt) <= now ||
        !latest ||
        nextScheduled.version > latest.version ||
        nextScheduled.version <= (current?.version ?? 0)))
  )
    throw Error("Unexpected bank refund timing state");
  for (const row of history) {
    for (const selected of [current, nextScheduled]) {
      if (
        selected &&
        row.id === selected.id &&
        JSON.stringify(row) !== JSON.stringify(selected)
      )
        throw Error("Contradictory bank refund timing record");
    }
    if (row.approvalStatus !== "APPROVED") continue;
    const when = Date.parse(row.effectiveAt);
    if (when <= now) {
      if (!current || row.version > current.version)
        throw Error("Incorrect current refund calendar");
    } else if (row.version > (current?.version ?? 0)) {
      if (
        !nextScheduled ||
        when < Date.parse(nextScheduled.effectiveAt) ||
        (when === Date.parse(nextScheduled.effectiveAt) &&
          row.version > nextScheduled.version)
      )
        throw Error("Incorrect scheduled refund calendar");
    }
  }
  return result;
}
export function validateRefundTimingReceipt(
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
  const row = refundVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q6" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(exactSettings.parse(row.settings)) !==
      JSON.stringify(exactSettings.parse(body.settings))
  )
    throw Error("Unexpected bank refund timing receipt");
  return row;
}
