import { z } from "zod";
import { workforceTemplateSchema } from "./workforce-schemas";
import { workforcePositionSchema } from "./workforce-positions";
export { workforcePositionSchema } from "./workforce-positions";
export const workforceReviewKindSchema = z.enum([
  "COVER_ENDING",
  "OPEN_ENDED_COVER",
  "SCHEDULED",
  "ENDED",
  "REMOVED",
  "UNASSIGNED",
  "EARLIER_STAFF_SETUP",
]);
export type WorkforceReviewKind = z.infer<typeof workforceReviewKindSchema>;
export const workforceDirectoryQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(120)
    .refine(
      (value) => ![...value].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127),
    )
    .optional(),
  role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]).optional(),
  position: workforcePositionSchema.optional(),
  branchId: z.uuid().optional(),
  cursor: z.uuid().optional(),
});
const directorySchema = z.object({
  review: z
    .object({
      kind: workforceReviewKindSchema,
      scope: z.enum(["ALL_PRIVILEGED_ACCOUNTS", "DELEGATED_STAFF_AND_DUTIES"]),
      windowEndsAt: z.iso.datetime().optional(),
    })
    .optional(),
  managementBranches: z
    .array(z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() }))
    .optional(),
  items: z.array(
    z.object({
      userId: z.uuid(),
      name: z.string(),
      email: z.string(),
      role: z.enum(["STAFF", "ADMIN", "SUPER_ADMIN"]),
      status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
      verified: z.boolean(),
      managed: z.boolean(),
      position: workforcePositionSchema.nullable(),
      version: z.number().int().nonnegative().nullable(),
      accountBranch: z
        .object({ id: z.uuid(), name: z.string(), isActive: z.boolean() })
        .nullable(),
      responsibilities: z.array(
        z.object({
          assignmentId: z.uuid(),
          template: workforceTemplateSchema,
          branch: z.object({ id: z.uuid(), name: z.string() }),
          scope: z.enum(["BRANCH", "ASSIGNED"]),
          temporary: z.boolean(),
          expiresAt: z.iso.datetime().nullable(),
        }),
      ),
      canInspect: z.boolean(),
      responsibilitiesMore: z.boolean(),
      reviewMatchesMore: z.boolean().optional(),
      reviewMatches: z
        .array(
          z.object({
            assignmentId: z.uuid(),
            template: workforceTemplateSchema,
            templateVersion: z.number().int().positive(),
            branch: z.object({ id: z.uuid(), name: z.string(), isActive: z.boolean() }),
            scope: z.enum(["BRANCH", "ASSIGNED"]),
            temporary: z.boolean(),
            startsAt: z.iso.datetime(),
            expiresAt: z.iso.datetime().nullable(),
            revokedAt: z.iso.datetime().nullable(),
          }),
        )
        .max(20)
        .optional(),
    }),
  ),
  nextCursor: z.uuid().optional(),
  generatedAt: z.iso.datetime(),
});
export const parseWorkforceDirectory = (value: unknown) => directorySchema.parse(value);
export type WorkforceDirectory = z.infer<typeof directorySchema>;

export function parseWorkforceReview(
  value: unknown,
  kind: WorkforceReviewKind,
  owner: boolean,
  days: 1 | 7 | 30 = 7,
) {
  const page = directorySchema.parse(value);
  const fail = () => {
    throw Error("The access review could not be verified. Refresh and try again.");
  };
  if (
    page.review?.kind !== kind ||
    page.review.scope !==
      (owner ? "ALL_PRIVILEGED_ACCOUNTS" : "DELEGATED_STAFF_AND_DUTIES")
  )
    fail();
  if (!owner && !page.managementBranches) fail();
  const now = Date.parse(page.generatedAt);
  const end = page.review?.windowEndsAt ? Date.parse(page.review.windowEndsAt) : null;
  if (kind === "COVER_ENDING" ? end !== now + days * 86400000 : end !== null) fail();
  if (new Set(page.items.map((p) => p.userId)).size !== page.items.length) fail();
  const branches = new Set(page.managementBranches?.map((b) => b.id));
  for (const person of page.items) {
    if (
      !person.canInspect ||
      !person.reviewMatches ||
      person.reviewMatchesMore === undefined
    )
      fail();
    if (
      !owner &&
      (person.role !== "STAFF" ||
        !person.accountBranch ||
        !branches.has(person.accountBranch.id))
    )
      fail();
    const matches = person.reviewMatches!;
    if (new Set(matches.map((a) => a.assignmentId)).size !== matches.length) fail();
    if (kind === "UNASSIGNED") {
      if (
        person.role !== "STAFF" ||
        !person.managed ||
        person.status !== "ACTIVE" ||
        !person.verified ||
        person.responsibilities.length ||
        person.responsibilitiesMore ||
        matches.length ||
        person.reviewMatchesMore
      )
        fail();
    } else if (kind === "EARLIER_STAFF_SETUP") {
      if (
        person.role !== "STAFF" ||
        person.managed ||
        matches.length ||
        person.reviewMatchesMore
      )
        fail();
    } else {
      if (!matches.length) fail();
      for (const a of matches) {
        if (
          ![1, 2].includes(a.templateVersion) ||
          (a.templateVersion === 1 && a.template.startsWith("CARE_")) ||
          a.scope !==
            (a.template === "SALES_CASHIER" ||
            a.template === "MECHANICAL_TECHNICIAN" ||
            a.template === "ELECTRICAL_TECHNICIAN"
              ? "ASSIGNED"
              : "BRANCH") ||
          (!owner && !branches.has(a.branch.id))
        )
          fail();
        const starts = Date.parse(a.startsAt),
          expires = a.expiresAt ? Date.parse(a.expiresAt) : null;
        if (kind !== "REMOVED" && a.revokedAt !== null) fail();
        if (
          kind === "COVER_ENDING" &&
          (!a.temporary ||
            !a.branch.isActive ||
            person.status !== "ACTIVE" ||
            !person.verified ||
            starts > now ||
            expires === null ||
            expires <= now ||
            expires > end!)
        )
          fail();
        if (kind === "OPEN_ENDED_COVER" && (!a.temporary || expires !== null)) fail();
        if (kind === "SCHEDULED" && starts <= now) fail();
        if (kind === "ENDED" && (expires === null || expires > now)) fail();
        if (kind === "REMOVED" && a.revokedAt === null) fail();
      }
    }
  }
  return page;
}
