import { z } from "zod";
import { workforceEffectiveAccessSchema } from "./workforce-effective-access";
import { capabilitySchema } from "./capability-schemas";
export const parseWorkforceAssignees = (value: unknown) =>
  z
    .object({
      items: z.array(
        z.object({ id: z.uuid(), firstName: z.string(), lastName: z.string() }),
      ),
    })
    .parse(value);
export const workforceTemplateLabels = {
  OPERATIONS: "Operations Supervisor",
  CUSTOMER_SERVICE: "Customer Service Officer",
  SALES_SUPERVISOR: "Sales Supervisor",
  SALES_CASHIER: "Sales Representative / Cashier",
  ACCOUNTANT: "Accountant",
  WORKSHOP_LEAD: "Workshop / Quality Service Lead",
  ELECTRICAL_TECHNICIAN: "Electrical / Diagnostics Technician",
  MECHANICAL_TECHNICIAN: "Mechanical Technician",
} as const;
export const workforceTemplateSchema = z.enum(
  Object.keys(workforceTemplateLabels) as [
    keyof typeof workforceTemplateLabels,
    ...Array<keyof typeof workforceTemplateLabels>,
  ],
);
export const assignmentSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  template: workforceTemplateSchema,
  templateVersion: z.number().int().positive().optional(),
  branchId: z.uuid(),
  scope: z.enum(["BRANCH", "ASSIGNED"]),
  temporary: z.boolean(),
  startsAt: z.iso.datetime(),
  expiresAt: z.iso.datetime().nullable(),
  reason: z.string(),
  assignedByUserId: z.uuid(),
  createdAt: z.iso.datetime(),
  revokedAt: z.iso.datetime().nullable(),
  revokedByUserId: z.uuid().nullable(),
  revocationReason: z.string().nullable(),
});
export const historicalAssignmentSchema = assignmentSchema.extend({
  template: z.string().min(1).max(80),
  scope: z.string().min(1).max(20),
});
export const workforceAccessSchema = z
  .object({
    managed: z.boolean(),
    userId: z.uuid(),
    staffId: z.uuid().nullable(),
    position: z.string().nullable(),
    department: z.string().nullable(),
    version: z.number().int(),
    assignments: z.array(assignmentSchema),
    permissions: z.array(z.string()),
    independentCapabilities: z.array(capabilitySchema).max(7).optional(),
    canManageAssignments: z.boolean(),
    canInviteAdmins: z.boolean().default(false),
    accessRevision: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    nextChangeAt: z.iso.datetime().nullable().optional(),
    capabilityScopes: z
      .array(
        z.object({
          capability: z.string(),
          branchId: z.uuid(),
          scope: z.enum(["BRANCH", "ASSIGNED"]),
        }),
      )
      .optional(),
    serverTime: z.iso.datetime(),
  })
  .superRefine((value, context) => {
    if (
      new Set(value.independentCapabilities).size !==
      (value.independentCapabilities?.length ?? 0)
    )
      context.addIssue({ code: "custom", message: "Duplicate independent permission" });
    const metadata = [value.accessRevision, value.nextChangeAt, value.capabilityScopes];
    if (metadata.every((field) => field === undefined)) return;
    if (metadata.some((field) => field === undefined)) {
      context.addIssue({
        code: "custom",
        message: "Incomplete current access projection",
      });
      return;
    }
    const scopes = value.capabilityScopes!;
    if (
      new Set(scopes.map((g) => `${g.capability}:${g.branchId}`)).size !==
        scopes.length ||
      value.permissions.some(
        (capability) => !scopes.some((g) => g.capability === capability),
      ) ||
      scopes.some(
        (g) =>
          !value.permissions.includes(g.capability) ||
          !value.assignments.some(
            (a) =>
              a.branchId === g.branchId && (g.scope !== "BRANCH" || a.scope === "BRANCH"),
          ),
      ) ||
      value.assignments.some(
        (a) =>
          a.userId !== value.userId ||
          a.revokedAt !== null ||
          Date.parse(a.startsAt) > Date.parse(value.serverTime) ||
          (a.expiresAt !== null &&
            Date.parse(a.expiresAt) <= Date.parse(value.serverTime)),
      ) ||
      (value.nextChangeAt !== null &&
        Date.parse(value.nextChangeAt!) <= Date.parse(value.serverTime))
    )
      context.addIssue({
        code: "custom",
        message: "Unexpected current access scope or time",
      });
  });
export type WorkforceAccess = z.infer<typeof workforceAccessSchema>;
export const parseWorkforceAccess = (value: unknown) =>
  workforceAccessSchema.parse(value);
export const workforceCounterPermissions = {
  jobs: ["JOBS_READ"],
  bookings: ["BOOKINGS_READ"],
  enquiries: ["CUSTOMER_ENQUIRIES", "SALES_ENQUIRIES"],
  complaints: ["COMPLAINTS"],
  orders: ["ORDERS_READ"],
} as const;
const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional();
const workforceOverviewSchema = z
  .object({
    counts: z
      .object({
        jobs: counter,
        bookings: counter,
        enquiries: counter,
        complaints: counter,
        orders: counter,
      })
      .strict(),
    generatedAt: z.iso.datetime(),
    access: workforceAccessSchema.safeExtend({ managed: z.literal(true) }),
    branches: z.array(z.object({ id: z.uuid(), name: z.string().trim().min(1) })),
  })
  .superRefine((value, context) => {
    for (const key of Object.keys(workforceCounterPermissions) as Array<
      keyof typeof workforceCounterPermissions
    >) {
      const permitted = workforceCounterPermissions[key].some((permission) =>
        value.access.permissions.includes(permission),
      );
      if (permitted !== (value.counts[key] !== undefined))
        context.addIssue({
          code: "custom",
          message: "Counter does not match current access",
          path: ["counts", key],
        });
    }
    const branches = new Set(value.branches.map((branch) => branch.id));
    const assigned = new Set(
      value.access.assignments.map((assignment) => assignment.branchId),
    );
    if (
      branches.size !== value.branches.length ||
      branches.size !== assigned.size ||
      [...assigned].some((id) => !branches.has(id)) ||
      value.access.assignments.some(
        (assignment) => assignment.userId !== value.access.userId,
      )
    )
      context.addIssue({
        code: "custom",
        message: "Responsibility projection does not match this account",
        path: ["access"],
      });
  });
export type WorkforceOverview = z.infer<typeof workforceOverviewSchema>;
export const parseWorkforceOverview = (value: unknown) =>
  workforceOverviewSchema.parse(value);
const work = z.object({
  id: z.uuid(),
  workOrderNumber: z.string(),
  status: z.string(),
  diagnosis: z.string().nullable(),
  internalNotes: z.string().nullable(),
  version: z.number().int(),
  workedByUserIds: z.array(z.uuid()),
  qualityApprovedByUserId: z.uuid().nullable(),
  qualityApprovedAt: z.iso.datetime().nullable(),
});
export const workforceJobSchema = z.object({
  id: z.uuid(),
  branchId: z.uuid().nullable(),
  scheduledAt: z.iso.datetime(),
  status: z.string(),
  version: z.number().int(),
  assignedStaffId: z.uuid().nullable(),
  customerNotes: z.string().nullable(),
  service: z.object({ name: z.string() }),
  vehicle: z
    .object({
      make: z.string(),
      model: z.string(),
      year: z.number().nullable(),
      registrationNumber: z.string().nullable(),
    })
    .nullable(),
  workOrder: work.nullable(),
});
export type WorkforceJob = z.infer<typeof workforceJobSchema>;
export const parseWorkforceJob = (value: unknown) => workforceJobSchema.parse(value);
const queueItemSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  version: z.number().int().optional(),
  subject: z.string().optional(),
  message: z.string().optional(),
  description: z.string().optional(),
  orderNumber: z.string().optional(),
  service: z.object({ name: z.string() }).optional(),
  scheduledAt: z.iso.datetime().optional(),
  paymentNumber: z.string().optional(),
  amountKobo: z.string().regex(/^\d+$/).optional(),
  currency: z.string().optional(),
  createdAt: z.iso.datetime().optional(),
  customer: z
    .object({ firstName: z.string(), lastName: z.string(), phone: z.string() })
    .optional(),
  items: z.array(z.object({ productName: z.string(), quantity: z.number() })).optional(),
});
export const parseWorkforceQueue = (value: unknown) =>
  z
    .object({ items: z.array(queueItemSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const parseWorkforceJobs = (value: unknown) =>
  z
    .object({ items: z.array(workforceJobSchema), nextCursor: z.uuid().optional() })
    .parse(value);
export const workforceAccountSchema = z.object({
  userId: z.uuid(),
  accountLabel: z.string().min(1),
  branches: z.array(
    z.object({ id: z.uuid(), name: z.string(), code: z.string(), isActive: z.boolean() }),
  ),
  management: z.object({
    canEnroll: z.boolean(),
    canAssign: z.boolean(),
    canRevoke: z.boolean(),
    canDelegate: z.boolean(),
    templates: z.array(workforceTemplateSchema),
    branchIds: z.array(z.uuid()).nullable(),
    delegationCapabilities: z
      .array(z.object({ capability: z.string(), scope: z.enum(["BRANCH", "ASSIGNED"]) }))
      .nullable()
      .optional(),
  }),
  access: z
    .object({
      userId: z.uuid(),
      position: z.string(),
      version: z.number().int(),
      enabledAt: z.iso.datetime(),
      delegatedTemplates: z.array(z.string()),
      delegatedBranchIds: z.array(z.uuid()),
      delegationPolicyVersion: z.number().int().positive().optional(),
    })
    .nullable(),
  assignments: z.array(historicalAssignmentSchema),
  activeAssignmentIds: z.array(z.uuid()),
  templatesVersion: z.number().int().positive().optional(),
  effectiveAccess: workforceEffectiveAccessSchema.optional(),
  assignmentDefinitions: z
    .record(
      z.uuid(),
      z
        .object({
          label: z.string(),
          department: z.string(),
          scope: z.string(),
          actions: z.array(z.string()),
        })
        .nullable(),
    )
    .optional(),
  templates: z.record(
    z.string(),
    z.object({
      label: z.string(),
      department: z.string(),
      scope: z.string(),
      actions: z.array(z.string()),
    }),
  ),
});
export type WorkforceAccount = z.infer<typeof workforceAccountSchema>;
export function workforceAssignmentLabel(template: string) {
  const known = workforceTemplateSchema.safeParse(template);
  return known.success
    ? workforceTemplateLabels[known.data]
    : `Unrecognised responsibility (${template})`;
}
export function workforceHistoryDefinition(
  data: WorkforceAccount,
  row: z.infer<typeof historicalAssignmentSchema>,
) {
  if (data.assignmentDefinitions) return data.assignmentDefinitions[row.id] ?? undefined;
  if ((row.templateVersion ?? 1) !== (data.templatesVersion ?? 1)) return undefined;
  const known = workforceTemplateSchema.safeParse(row.template);
  const definition = known.success ? data.templates[known.data] : undefined;
  return definition?.scope === row.scope ? definition : undefined;
}
export const parseWorkforceAccount = (value: unknown) => {
  const r = workforceAccountSchema.parse(value);
  if (
    (r.access && r.access.userId !== r.userId) ||
    r.assignments.some((a) => a.userId !== r.userId) ||
    new Set(r.assignments.map((a) => a.id)).size !== r.assignments.length ||
    new Set(r.activeAssignmentIds).size !== r.activeAssignmentIds.length ||
    r.activeAssignmentIds.some(
      (id) =>
        !r.assignments.some(
          (a) => a.id === id && !a.revokedAt && workforceHistoryDefinition(r, a),
        ),
    ) ||
    new Set(r.branches.map((b) => b.id)).size !== r.branches.length ||
    r.management.branchIds?.some(
      (id) => !r.branches.some((b) => b.id === id && b.isActive),
    ) ||
    (r.assignmentDefinitions !== undefined &&
      (Object.keys(r.assignmentDefinitions).length !== r.assignments.length ||
        r.assignments.some(
          (a) =>
            !Object.hasOwn(r.assignmentDefinitions!, a.id) ||
            (r.assignmentDefinitions![a.id] !== null &&
              r.assignmentDefinitions![a.id]?.scope !== a.scope),
        ) ||
        r.activeAssignmentIds.some((id) => !r.assignmentDefinitions![id])))
  )
    throw Error("Unexpected responsibility account scope");
  if (r.effectiveAccess) {
    const e = r.effectiveAccess;
    if (
      (r.management.branchIds === null ? "FULL" : "DELEGATED") !== e.visibility ||
      (e.baseline === "INACTIVE" && (e.grants.length || r.activeAssignmentIds.length)) ||
      e.grants.some(
        (grant) =>
          (e.visibility === "DELEGATED" &&
            (!r.management.delegationCapabilities?.some(
              (c) => c.capability === grant.capability,
            ) ||
              (grant.scope === "BRANCH" &&
                r.management.delegationCapabilities.find(
                  (c) => c.capability === grant.capability,
                )?.scope !== "BRANCH"))) ||
          !r.branches.some(
            (b) => b.id === grant.branch.id && b.isActive && b.name === grant.branch.name,
          ) ||
          (r.management.branchIds !== null &&
            !r.management.branchIds.includes(grant.branch.id)) ||
          grant.sources.some((source) => {
            if (source.kind === "OTHER")
              return (
                e.visibility !== "DELEGATED" ||
                (source.scope === "BRANCH" &&
                  r.management.delegationCapabilities?.find(
                    (c) => c.capability === grant.capability,
                  )?.scope !== "BRANCH")
              );
            if (source.kind !== "ASSIGNMENT") return true;
            const a = r.assignments.find((a) => a.id === source.assignmentId);
            return (
              !a ||
              !r.activeAssignmentIds.includes(a.id) ||
              a.branchId !== grant.branch.id ||
              a.scope !== source.scope ||
              !r.assignmentDefinitions?.[a.id]?.actions.includes(grant.capability)
            );
          }),
      )
    )
      throw Error("Unexpected effective access scope");
  }
  return r;
};
