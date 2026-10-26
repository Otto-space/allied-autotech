import type { z } from "zod";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import { prisma } from "../../config/database.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { lockAccessActor } from "./team-access-security.js";
import { lockWorkforce } from "./workforce-access.service.js";
import {
  positionSchema,
  templateSchema,
  workforceDenied,
  workforceNotFound,
  workforceSnapshot,
} from "./workforce.policy.js";
import type { workforceDirectoryQuerySchema } from "./workforce.schemas.js";
import {
  definitionForAssignment,
  supportedAssignmentPolicies,
} from "./workforce-catalogue.js";

/** Account discovery follows the existing owner/delegation boundary of inspect().
 * No customer profiles, security factors, passwords or operational records are read.
 */
export class WorkforceDirectoryService {
  async list(
    actor: AuthenticatedActor,
    query: z.infer<typeof workforceDirectoryQuerySchema>,
  ) {
    return prisma.$transaction(async (tx) => {
      await lockWorkforce(tx);
      await lockAccessActor(tx, actor);
      if (!["ADMIN", "SUPER_ADMIN"].includes(actor.role)) workforceDenied();
      const own = await workforceSnapshot(tx, actor);
      if (!own.canManageAssignments) workforceDenied();
      const envelope =
        actor.role === "ADMIN"
          ? await tx.workforceAccess.findUnique({
              where: { userId: actor.userId },
              select: { delegatedBranchIds: true, delegatedTemplates: true },
            })
          : null;
      const scope: Prisma.UserWhereInput =
        actor.role === "SUPER_ADMIN"
          ? { role: { in: ["STAFF", "ADMIN", "SUPER_ADMIN"] } }
          : {
              role: "STAFF",
              staffProfile: {
                is: { branchId: { in: envelope?.delegatedBranchIds ?? [] } },
              },
            };
      const filters: Prisma.UserWhereInput[] = [scope];
      if (query.role) filters.push({ role: query.role });
      if (query.status) filters.push({ status: query.status });
      if (query.position)
        filters.push({ workforceAccess: { is: { position: query.position } } });
      if (query.branchId)
        filters.push({ staffProfile: { is: { branchId: query.branchId } } });
      for (const term of query.q?.split(/\s+/).filter(Boolean) ?? [])
        filters.push({
          OR: [
            { email: { contains: term, mode: "insensitive" } },
            {
              staffProfile: {
                is: { firstName: { contains: term, mode: "insensitive" } },
              },
            },
            {
              staffProfile: { is: { lastName: { contains: term, mode: "insensitive" } } },
            },
          ],
        });
      const where: Prisma.UserWhereInput = { AND: filters };
      if (
        query.cursor &&
        !(await tx.user.findFirst({
          where: { AND: [where, { id: query.cursor }] },
          select: { id: true },
        }))
      )
        workforceNotFound();
      const now = new Date();
      const rows = await tx.user.findMany({
        where: query.cursor ? { AND: [where, { id: { gt: query.cursor } }] } : where,
        orderBy: { id: "asc" },
        take: query.limit + 1,
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          emailVerifiedAt: true,
          staffProfile: {
            select: {
              firstName: true,
              lastName: true,
              branch: { select: { id: true, name: true, isActive: true } },
            },
          },
          workforceAccess: {
            select: {
              position: true,
              version: true,
              assignments: {
                where: {
                  revokedAt: null,
                  startsAt: { lte: now },
                  OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
                  branch: { isActive: true },
                  AND: [
                    {
                      OR: supportedAssignmentPolicies(),
                    },
                  ],
                  template: {
                    in: envelope
                      ? templateSchema.options.filter((t) =>
                          envelope.delegatedTemplates.includes(t),
                        )
                      : [...templateSchema.options],
                  },
                  ...(envelope ? { branchId: { in: envelope.delegatedBranchIds } } : {}),
                },
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                take: 21,
                select: {
                  id: true,
                  template: true,
                  templateVersion: true,
                  scope: true,
                  temporary: true,
                  expiresAt: true,
                  branch: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      });
      const items = rows.slice(0, query.limit).map((row) => ({
        userId: row.id,
        name:
          [row.staffProfile?.firstName, row.staffProfile?.lastName]
            .filter(Boolean)
            .join(" ") || row.email,
        email: row.email,
        role: row.role,
        status: row.status,
        verified: row.emailVerifiedAt !== null,
        managed: row.workforceAccess !== null,
        position: positionSchema.safeParse(row.workforceAccess?.position).success
          ? row.workforceAccess!.position
          : null,
        version: row.workforceAccess?.version ?? null,
        accountBranch: row.staffProfile?.branch ?? null,
        responsibilitiesMore: (row.workforceAccess?.assignments.length ?? 0) > 20,
        responsibilities: (row.workforceAccess?.assignments ?? [])
          .slice(0, 20)
          .filter((a) => {
            return definitionForAssignment(a) !== undefined;
          })
          .map((a) => ({
            assignmentId: a.id,
            template: a.template,
            branch: a.branch,
            scope: a.scope,
            temporary: a.temporary,
            expiresAt: a.expiresAt?.toISOString() ?? null,
          })),
        canInspect: true,
      }));
      return {
        items,
        ...(rows.length > query.limit ? { nextCursor: items.at(-1)!.userId } : {}),
        generatedAt: now.toISOString(),
      };
    });
  }
}
