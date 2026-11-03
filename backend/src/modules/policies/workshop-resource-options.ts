import { z } from "zod";
import type { Prisma } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { prisma } from "../../config/database.js";
import { withTransactionRetry } from "../../common/database/transaction-retry.js";
import { lockAccessActor } from "../organization/team-access-security.js";
import {
  assignmentAllows,
  supportedAssignmentPolicies,
} from "../organization/workforce-catalogue.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { paymentForbidden } from "../payments/payments.errors.js";
import { organizationResourceNotFound } from "../organization/organization.errors.js";
export const resourceOptionsQuery = z
  .strictObject({
    kind: z.enum(["SERVICE", "TECHNICIAN"]),
    q: z.string().trim().max(80).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(25),
    ids: z.string().max(3700).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.ids !== undefined) {
      const ids = v.ids.split(",");
      if (
        ids.length > 100 ||
        ids.some((id) => !z.uuid().safeParse(id).success) ||
        new Set(ids.map((id) => id.toLowerCase())).size !== ids.length
      )
        ctx.addIssue({
          code: "custom",
          path: ["ids"],
          message: "Select up to 100 distinct record references",
        });
      if (v.q || v.cursor)
        ctx.addIssue({
          code: "custom",
          path: ["ids"],
          message: "Use record lookup separately from search",
        });
    }
  });
export const resourceOptionsResponse = z.strictObject({
  branchId: z.uuid(),
  kind: z.enum(["SERVICE", "TECHNICIAN"]),
  items: z
    .array(
      z.strictObject({ id: z.uuid(), label: z.string().min(1), eligible: z.boolean() }),
    )
    .max(100),
  nextCursor: z.uuid().nullable(),
});
export async function readResourceOptions(
  actor: AuthenticatedActor,
  branchId: string,
  input: z.infer<typeof resourceOptionsQuery>,
  context: RequestSecurityContext,
) {
  if (actor.role !== "SUPER_ADMIN" || !actor.mfaVerifiedAt) throw paymentForbidden();
  return withTransactionRetry(
    prisma,
    async (tx) => {
      await lockAccessActor(tx, actor);
      const branch = await tx.branch.findUnique({
        where: { id: branchId },
        select: { isActive: true },
      });
      if (!branch) throw organizationResourceNotFound();
      const ids = input.ids?.split(",").map((id) => id.toLowerCase()),
        now = new Date();
      let items: Array<{ id: string; label: string; eligible: boolean }>,
        nextCursor: string | null = null;
      if (input.kind === "SERVICE") {
        const rows = await tx.service.findMany({
          where: ids
            ? { id: { in: ids } }
            : {
                isActive: true,
                ...(input.cursor ? { id: { gt: input.cursor } } : {}),
                ...(input.q ? { name: { contains: input.q, mode: "insensitive" } } : {}),
              },
          select: { id: true, name: true, isActive: true },
          orderBy: { id: "asc" },
          take: ids ? 100 : input.limit + 1,
        });
        if (!ids && rows.length > input.limit) {
          rows.pop();
          nextCursor = rows.at(-1)!.id;
        }
        items = rows.map((row) => ({
          id: row.id,
          label: row.name || "Unnamed service",
          eligible: branch.isActive && row.isActive,
        }));
      } else {
        const pairs = supportedAssignmentPolicies().filter((pair) =>
          assignmentAllows(pair, "JOBS_UPDATE"),
        );
        const eligible: Prisma.StaffProfileWhereInput = {
          user: {
            role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] },
            status: "ACTIVE",
            emailVerifiedAt: { not: null },
          },
          OR: [
            { branchId, user: { workforceAccess: { is: null } } },
            {
              user: {
                workforceAccess: {
                  is: {
                    assignments: {
                      some: {
                        branchId,
                        branch: { isActive: true },
                        revokedAt: null,
                        startsAt: { lte: now },
                        AND: [
                          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
                          { OR: pairs },
                        ],
                      },
                    },
                  },
                },
              },
            },
          ],
        };
        const scope: Prisma.StaffProfileWhereInput = ids
          ? { id: { in: ids } }
          : {
              AND: [
                eligible,
                ...(input.cursor ? [{ id: { gt: input.cursor } }] : []),
                ...(input.q
                  ? [
                      {
                        OR: [
                          {
                            firstName: {
                              contains: input.q,
                              mode: "insensitive" as const,
                            },
                          },
                          {
                            lastName: { contains: input.q, mode: "insensitive" as const },
                          },
                        ],
                      },
                    ]
                  : []),
              ],
            };
        const rows = await tx.staffProfile.findMany({
          where: scope,
          select: { id: true, firstName: true, lastName: true },
          orderBy: { id: "asc" },
          take: ids ? 100 : input.limit + 1,
        });
        if (!ids && rows.length > input.limit) {
          rows.pop();
          nextCursor = rows.at(-1)!.id;
        }
        const current = ids
          ? await tx.staffProfile.findMany({
              where: { AND: [eligible, { id: { in: rows.map((row) => row.id) } }] },
              select: { id: true },
            })
          : rows;
        const allowed = new Set(current.map((row) => row.id));
        items = rows.map((row) => ({
          id: row.id,
          label: `${row.firstName} ${row.lastName}`.trim() || "Unnamed technician",
          eligible: branch.isActive && allowed.has(row.id),
        }));
      }
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "READ",
        entityType: "BRANCH",
        entityId: branchId,
        newValues: {
          resource: "WORKSHOP_RESOURCE_OPTIONS",
          kind: input.kind,
          returnedCount: items.length,
        },
        context,
      });
      return { branchId, kind: input.kind, items, nextCursor };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
