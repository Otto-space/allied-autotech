import { z } from "zod";
import { fitmentQualifierKeys } from "@/lib/parts-fitment";

const uuid = z.uuid();
const time = z.iso.datetime({ offset: true });
export const reviewStates = [
  "DRAFT",
  "PENDING",
  "APPROVED",
  "REJECTED",
  "RETIRED",
] as const;
export const fitmentAccessSchema = z.object({
  canAuthor: z.boolean(),
  canReview: z.boolean(),
  globalAuthor: z.boolean(),
  globalReviewer: z.boolean(),
  authorBranches: z.array(uuid),
  reviewBranches: z.array(uuid),
  branches: z.array(z.object({ id: uuid, name: z.string() })),
});
export type FitmentAccess = z.infer<typeof fitmentAccessSchema>;
export const parseFitmentAccess = (value: unknown) => fitmentAccessSchema.parse(value);
export const staffFitmentProductSchema = z.object({
  id: uuid,
  name: z.string(),
  sku: z.string(),
  isActive: z.boolean(),
  productType: z.string().nullable(),
});
export const parseFitmentProduct = (value: unknown) =>
  staffFitmentProductSchema.parse(value);
const account = z.object({
  id: uuid,
  email: z.email(),
  staffProfile: z.object({ firstName: z.string(), lastName: z.string() }).nullable(),
});
const qualifiers = Object.fromEntries(
  fitmentQualifierKeys.map((key) => [key, z.string().nullable()]),
) as Record<(typeof fitmentQualifierKeys)[number], z.ZodNullable<z.ZodString>>;
export const staffFitmentRuleSchema = z.object({
  id: uuid,
  productId: uuid,
  branchId: uuid.nullable(),
  vehicleModelId: uuid.nullable(),
  make: z.string(),
  model: z.string().nullable(),
  yearFrom: z.number().int().nullable(),
  yearTo: z.number().int().nullable(),
  scope: z.enum(["MODEL", "UNIVERSAL"]),
  effect: z.enum(["INCLUDE", "EXCLUDE"]),
  reviewStatus: z.enum(reviewStates),
  safetyCritical: z.boolean(),
  allVariantsConfirmed: z.boolean(),
  requiredQualifiers: z.array(z.enum(fitmentQualifierKeys)),
  ...qualifiers,
  sourceReference: z.string().nullable(),
  evidenceNotes: z.string().nullable(),
  notes: z.string().nullable(),
  reviewNote: z.string().nullable(),
  createdByUserId: uuid.nullable(),
  updatedByUserId: uuid.nullable(),
  reviewedByUserId: uuid.nullable(),
  createdAt: time,
  updatedAt: time,
  submittedAt: time.nullable(),
  reviewedAt: time.nullable(),
  version: z.number().int().nonnegative(),
  product: staffFitmentProductSchema.pick({ id: true, name: true, sku: true }),
  vehicleModel: z
    .object({
      id: uuid,
      name: z.string(),
      makeId: uuid,
      yearFrom: z.number().int(),
      yearTo: z.number().int(),
      make: z.object({ id: uuid, name: z.string() }),
    })
    .nullable(),
  createdBy: account.nullable(),
  updatedBy: account.nullable(),
  reviewedBy: account.nullable(),
});
export type StaffFitmentRule = z.infer<typeof staffFitmentRuleSchema>;
export const parseFitmentRule = (value: unknown) => staffFitmentRuleSchema.parse(value);
export const parseFitmentRules = (value: unknown) =>
  z
    .object({
      items: z.array(staffFitmentRuleSchema).max(100),
      nextCursor: uuid.optional(),
    })
    .parse(value);
export const parseFitmentProducts = (value: unknown) =>
  z
    .object({
      items: z.array(staffFitmentProductSchema).max(100),
      nextCursor: uuid.optional(),
    })
    .parse(value);
export const parseFitmentHistory = (value: unknown) =>
  z
    .object({
      items: z
        .array(
          z.object({
            id: uuid,
            compatibilityId: uuid,
            actorUserId: uuid,
            actor: account,
            action: z.string(),
            version: z.number().int(),
            createdAt: time,
            snapshot: z.record(z.string(), z.unknown()),
          }),
        )
        .max(100),
      nextCursor: uuid.optional(),
    })
    .parse(value);
export function fitmentAccountLabel(value: z.infer<typeof account> | null) {
  return value
    ? value.staffProfile
      ? `${value.staffProfile.firstName} ${value.staffProfile.lastName}`
      : value.email
    : "Not recorded";
}
export function canEditFitment(
  access: FitmentAccess,
  rule: Pick<StaffFitmentRule, "branchId" | "reviewStatus">,
) {
  return (
    access.canAuthor &&
    (access.globalAuthor ||
      (!!rule.branchId && access.authorBranches.includes(rule.branchId))) &&
    rule.reviewStatus !== "RETIRED"
  );
}
export function canReviewFitment(
  access: FitmentAccess,
  rule: Pick<
    StaffFitmentRule,
    "branchId" | "reviewStatus" | "createdByUserId" | "updatedByUserId"
  >,
  userId: string,
) {
  return (
    rule.reviewStatus === "PENDING" &&
    access.canReview &&
    (access.globalReviewer ||
      (!!rule.branchId && access.reviewBranches.includes(rule.branchId))) &&
    rule.createdByUserId !== userId &&
    rule.updatedByUserId !== userId
  );
}

export function staffFitmentQuery(input: URLSearchParams) {
  let invalid = false;
  const params = new URLSearchParams();
  for (const key of ["productId", "ruleId", "reviewStatus", "cursor", "view"]) {
    const value = input.get(key);
    if (input.getAll(key).length > 1) invalid = true;
    if (!value) continue;
    const valid =
      key === "view"
        ? value === "create"
        : key === "reviewStatus"
          ? (reviewStates as readonly string[]).includes(value)
          : uuid.safeParse(value).success;
    if (valid) params.set(key, value);
    else invalid = true;
  }
  if (
    ((params.has("ruleId") || params.has("view")) && !params.has("productId")) ||
    (params.has("ruleId") && params.has("view"))
  )
    invalid = true;
  const api = new URLSearchParams({ limit: "25" });
  for (const key of ["productId", "reviewStatus", "cursor"])
    if (params.has(key)) api.set(key, params.get(key)!);
  return {
    params,
    api,
    invalid,
    productId: params.get("productId"),
    ruleId: params.get("ruleId"),
    creating: params.get("view") === "create",
  };
}
