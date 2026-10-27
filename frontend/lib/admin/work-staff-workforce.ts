import { z } from "zod";
import { assignableWorkforcePositionSchema } from "@/lib/api/workforce-positions";
import {
  assignmentSchema,
  historicalAssignmentSchema,
  workforceTemplateSchema,
  type WorkforceAccount,
} from "@/lib/api/workforce-schemas";
const proof = {
  receiptVersion: z.literal(2).default(2),
  currentPassword: z.string().min(1).max(256),
  reason: z.string().trim().min(10).max(1000),
  expectedVersion: z.number().int().nonnegative().nullable(),
};
const accessReceipt = z
  .object({
    userId: z.uuid(),
    position: z.string(),
    enabledAt: z.iso.datetime(),
    updatedByUserId: z.uuid(),
    version: z.number().int().nonnegative(),
    delegatedTemplates: z.array(z.string()),
    delegatedBranchIds: z.array(z.uuid()),
    delegationPolicyVersion: z.number().int().positive().optional(),
  })
  .strict();
export type WorkforceAction = "enroll" | "assign" | "revoke" | "delegate";
export function workforceBody(action: WorkforceAction, input: unknown) {
  const base = z.object(proof);
  if (action === "enroll")
    return base
      .extend({ position: assignableWorkforcePositionSchema })
      .strict()
      .parse(input);
  if (action === "assign")
    return base
      .extend({
        expectedVersion: z.number().int().nonnegative(),
        template: workforceTemplateSchema,
        expectedTemplateVersion: z.number().int().positive().default(1),
        expectedAccessPreview: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
        branchId: z.uuid(),
        temporary: z.boolean(),
        startsAt: z.iso.datetime(),
        expiresAt: z.iso.datetime().nullable(),
      })
      .strict()
      .refine((v) => !v.expiresAt || Date.parse(v.expiresAt) > Date.parse(v.startsAt), {
        path: ["expiresAt"],
        message: "Expiry must be after the start time.",
      })
      .parse(input);
  if (action === "delegate")
    return base
      .extend({
        expectedVersion: z.number().int().nonnegative(),
        templates: z
          .array(workforceTemplateSchema)
          .max(workforceTemplateSchema.options.length),
        branchIds: z.array(z.uuid()).max(20),
        allowAdminInvitations: z.boolean(),
        expectedPolicyVersion: z.number().int().positive().default(1),
      })
      .strict()
      .parse(input);
  return base
    .extend({
      expectedVersion: z.number().int().nonnegative(),
      expectedAccessPreview: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
    })
    .strict()
    .parse(input);
}
export function workforcePreviewBody(
  action: "assign" | "revoke",
  body: Record<string, unknown>,
  assignmentId?: string,
) {
  const shared = { operation: action, expectedVersion: body.expectedVersion };
  return action === "revoke"
    ? { ...shared, assignmentId }
    : {
        ...shared,
        expectedTemplateVersion: body.expectedTemplateVersion,
        template: body.template,
        branchId: body.branchId,
        startsAt: body.startsAt,
        expiresAt: body.expiresAt,
      };
}
const equalSet = (a: readonly string[], b: readonly string[]) =>
  new Set(a).size === a.length &&
  new Set(b).size === b.length &&
  [...a].sort().join("|") === [...b].sort().join("|");
export function verifyWorkforceReceipt(
  value: unknown,
  action: WorkforceAction,
  target: string,
  actor: string,
  input: Record<string, unknown>,
  current: WorkforceAccount,
  assignmentId?: string,
) {
  if (action === "enroll" || action === "delegate") {
    const result = accessReceipt.parse(value),
      version = current.access?.version;
    if (
      result.userId !== target ||
      result.updatedByUserId !== actor ||
      result.version !== (version === undefined ? 0 : version + 1) ||
      (current.access && result.enabledAt !== current.access.enabledAt)
    )
      throw Error("Unexpected responsibility receipt");
    const templates =
      action === "delegate"
        ? [
            ...new Set([
              ...(input.templates as string[]),
              ...(input.allowAdminInvitations ? ["ADMIN_INVITE"] : []),
            ]),
          ]
        : (current.access?.delegatedTemplates ?? []);
    const branches =
      action === "delegate"
        ? [...new Set(input.branchIds as string[])]
        : (current.access?.delegatedBranchIds ?? []);
    if (
      result.position !==
        (action === "enroll" ? input.position : current.access?.position) ||
      !equalSet(result.delegatedTemplates, templates) ||
      !equalSet(result.delegatedBranchIds, branches) ||
      (result.delegationPolicyVersion ?? 1) !==
        (action === "delegate"
          ? (current.templatesVersion ?? 1)
          : (current.access?.delegationPolicyVersion ?? current.templatesVersion ?? 1))
    )
      throw Error("Unexpected responsibility receipt");
    return result;
  }
  const result = (action === "revoke" ? historicalAssignmentSchema : assignmentSchema)
    .strict()
    .parse(value);
  if (result.userId !== target) throw Error("Unexpected assignment account");
  if (action === "assign") {
    if (
      current.assignments.some((a) => a.id === result.id) ||
      result.assignedByUserId !== actor ||
      result.template !== input.template ||
      (result.templateVersion ?? 1) !== (input.expectedTemplateVersion ?? 1) ||
      result.branchId !== input.branchId ||
      result.scope !== current.templates[result.template]?.scope ||
      result.temporary !== input.temporary ||
      result.startsAt !== input.startsAt ||
      result.expiresAt !== input.expiresAt ||
      result.reason !== input.reason ||
      result.revokedAt !== null ||
      result.revokedByUserId !== null ||
      result.revocationReason !== null
    )
      throw Error("Unexpected assignment receipt");
  } else {
    const prior = current.assignments.find((a) => a.id === assignmentId);
    if (
      !prior ||
      result.id !== assignmentId ||
      !result.revokedAt ||
      result.revokedByUserId !== actor ||
      result.revocationReason !== input.reason ||
      (
        [
          "template",
          "templateVersion",
          "branchId",
          "scope",
          "temporary",
          "startsAt",
          "expiresAt",
          "reason",
          "assignedByUserId",
          "createdAt",
        ] as const
      ).some((k) => result[k] !== prior[k])
    )
      throw Error("Unexpected revocation receipt");
  }
  return result;
}
export function workforceLocalTime(value: FormDataEntryValue | null) {
  const text = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))
    throw Error("Choose a valid date and time.");
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw Error("Choose a valid date and time.");
  const [year, month, day, hour, minute] = text.split(/[-T:]/).map(Number);
  if (
    date.getFullYear() !== year ||
    date.getMonth() + 1 !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  )
    throw Error("Choose a valid local date and time.");
  return date.toISOString();
}
