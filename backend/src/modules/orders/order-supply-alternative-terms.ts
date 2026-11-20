import { z } from "zod";
export const supplyAlternativeAgreementVersion =
  "SUPPLY_ALTERNATIVE_20261110_V1" as const;
export const supplyAlternativeSnapshotSchema = z
  .object({
    version: z.literal(supplyAlternativeAgreementVersion),
    choiceId: z.uuid(),
    originalOrderId: z.uuid(),
    monetaryHandling: z.literal("SEPARATE_ORIGINAL_REFUND_BEFORE_NEW_PAYMENT"),
    provenance: z.literal("ENGINEERING_UNDER_OWNER_D17_DELEGATION"),
  })
  .strict();
export function readSupplyAlternativeTerms(policy: unknown) {
  const value =
    policy && typeof policy === "object" && !Array.isArray(policy)
      ? (policy as Record<string, unknown>)["supplyAlternative"]
      : undefined;
  const result = supplyAlternativeSnapshotSchema.safeParse(value);
  return result.success ? result.data : null;
}
