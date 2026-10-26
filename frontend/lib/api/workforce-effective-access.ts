import { z } from "zod";
import type { WorkforceAccount } from "./workforce-schemas";

const grant = z
  .object({
    capability: z.string().regex(/^[A-Z][A-Z_]{1,63}$/),
    label: z.string().min(1).max(200),
    branch: z.object({ id: z.uuid(), name: z.string().min(1) }),
    scope: z.enum(["BRANCH", "ASSIGNED"]),
    sources: z
      .array(
        z.object({
          assignmentId: z.uuid().nullable(),
          label: z.string().min(1).max(200),
          scope: z.enum(["BRANCH", "ASSIGNED"]),
          kind: z.enum(["ASSIGNMENT", "PROPOSED", "OTHER"]),
        }),
      )
      .min(1),
  })
  .superRefine((row, context) => {
    if (
      row.sources.some((source) =>
        source.kind === "ASSIGNMENT"
          ? source.assignmentId === null
          : source.assignmentId !== null ||
            (source.kind === "OTHER" && source.label !== "Another active responsibility"),
      )
    )
      context.addIssue({ code: "custom", message: "Unexpected responsibility source" });
    if (row.scope === "BRANCH" && !row.sources.some((s) => s.scope === "BRANCH"))
      context.addIssue({
        code: "custom",
        message: "Branch access requires a branch grant",
      });
  });
const grants = z.array(grant).superRefine((rows, context) => {
  if (new Set(rows.map((r) => `${r.capability}:${r.branch.id}`)).size !== rows.length)
    context.addIssue({ code: "custom", message: "Duplicate effective access" });
});
export const workforceEffectiveAccessSchema = z.object({
  baseline: z.enum(["OWNER", "LEGACY", "MANAGED", "INACTIVE"]),
  visibility: z.enum(["FULL", "DELEGATED"]),
  evaluatedAt: z.iso.datetime(),
  grants,
  responsibilityGrantsOnly: z.literal(true),
});
export const workforceAccessPreviewSchema = z.object({
  userId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
  operation: z.enum(["assign", "revoke"]),
  evaluatedAt: z.iso.datetime(),
  scheduled: z.boolean(),
  visibility: z.enum(["FULL", "DELEGATED"]),
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  added: grants,
  removed: grants,
  retained: grants,
  responsibilityGrantsOnly: z.literal(true),
});
export type EffectiveWorkforceGrant = z.infer<typeof grant>;
export type EffectiveWorkforceAccess = z.infer<typeof workforceEffectiveAccessSchema>;
export type WorkforceAccessPreview = z.infer<typeof workforceAccessPreviewSchema>;
export function parseWorkforceAccessPreview(
  value: unknown,
  expected: {
    userId: string;
    expectedVersion: unknown;
    operation: "assign" | "revoke";
    account?: WorkforceAccount;
    input?: Record<string, unknown>;
  },
) {
  const result = workforceAccessPreviewSchema.parse(value);
  if (
    result.userId !== expected.userId ||
    result.expectedVersion !== expected.expectedVersion ||
    result.operation !== expected.operation
  )
    throw Error("Unexpected access preview context");
  if (expected.account) {
    const account = expected.account,
      input = expected.input;
    const proposed = input?.template
      ? account.templates[String(input.template)]
      : undefined;
    const delegated = account.management.branchIds !== null;
    const allowedScope = (capability: string) =>
      account.management.delegationCapabilities?.find((c) => c.capability === capability)
        ?.scope;
    const assignedOnly = (capability: string) =>
      delegated && allowedScope(capability) === "ASSIGNED";
    if (
      result.visibility !== (delegated ? "DELEGATED" : "FULL") ||
      [...result.added, ...result.removed, ...result.retained].some(
        (row) =>
          (!account.branches.some((b) => b.isActive && b.id === row.branch.id) &&
            row.branch.id !== input?.branchId) ||
          (delegated && !account.management.branchIds!.includes(row.branch.id)) ||
          (delegated && !allowedScope(row.capability)) ||
          (assignedOnly(row.capability) && row.scope === "BRANCH") ||
          row.sources.some((source) => {
            if (source.kind === "OTHER")
              return (
                !delegated ||
                (assignedOnly(row.capability) && source.scope === "BRANCH") ||
                !allowedScope(row.capability)
              );
            if (source.kind === "PROPOSED")
              return (
                result.operation !== "assign" ||
                row.branch.id !== input?.branchId ||
                !proposed?.actions.includes(row.capability) ||
                proposed.scope !== source.scope ||
                proposed.label !== source.label
              );
            const assignment = account.assignments.find(
              (a) => a.id === source.assignmentId,
            );
            const definition =
              assignment && account.assignmentDefinitions?.[assignment.id];
            return (
              !assignment ||
              assignment.branchId !== row.branch.id ||
              assignment.scope !== source.scope ||
              !definition?.actions.includes(row.capability) ||
              definition.label !== source.label
            );
          }),
      )
    )
      throw Error("Unexpected access preview scope");
  }
  return result;
}
