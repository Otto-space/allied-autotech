import { deliverySettingsSchema } from "@/lib/api/fulfillment-schemas";
import { z } from "zod";
import { policyVersionSchema, type PolicyVersion } from "@/lib/api/policy-schemas";
const exactSettings = deliverySettingsSchema
  .safeExtend({
    zones: deliverySettingsSchema.shape.zones.element.strict().array().min(1).max(100),
  })
  .strict();
const deliveryVersion = policyVersionSchema
  .strict()
  .refine((v) => v.key === "delivery", "Unexpected policy key");
const workspace = z
  .object({
    evaluatedAt: z.iso.datetime({ offset: true }),
    availability: z
      .object({ checkoutEnabled: z.boolean(), deliveryEnabled: z.boolean() })
      .strict(),
    current: deliveryVersion.nullable(),
    latest: deliveryVersion.nullable(),
    nextScheduled: deliveryVersion.nullable(),
    history: z.array(deliveryVersion).max(100),
  })
  .strict();
export type DeliveryWorkspace = z.infer<typeof workspace>;
export function parseDeliveryWorkspace(value: unknown): DeliveryWorkspace {
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
    throw Error("Unexpected delivery policy state");
  for (const row of history) {
    const when = Date.parse(row.effectiveAt);
    const selected = when <= now ? current : nextScheduled;
    if (!selected) throw Error("Missing selected delivery policy");
    const selectedAt = Date.parse(selected.effectiveAt);
    if (
      (when <= now ? when > selectedAt : when < selectedAt) ||
      (when === selectedAt && row.version > selected.version) ||
      (row.id === selected.id && JSON.stringify(row) !== JSON.stringify(selected))
    )
      throw Error("Contradictory delivery policy selection");
  }
  if (
    result.availability.deliveryEnabled &&
    (!result.availability.checkoutEnabled ||
      current?.approvalStatus !== "APPROVED" ||
      !exactSettings.safeParse(current.settings).success)
  )
    throw Error("Contradictory delivery availability");
  return result;
}
export function validateDeliveryReceipt(
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
  const row = deliveryVersion.parse(value);
  if (
    row.version !== body.expectedVersion + 1 ||
    row.approvalStatus !== "APPROVED" ||
    row.approvedByUserId !== actor ||
    row.sourceQuestion !== "Q1" ||
    row.sourceSignatory !== null ||
    row.source !== body.source ||
    row.approvalEvidence !== body.approvalEvidence ||
    Date.parse(row.effectiveAt) !== Date.parse(body.effectiveAt) ||
    JSON.stringify(exactSettings.parse(row.settings)) !==
      JSON.stringify(exactSettings.parse(body.settings))
  )
    throw Error("Unexpected delivery policy receipt");
  return row;
}
