import { createHash } from "node:crypto";
import { planOwnerServiceGroups } from "./owner-service-structure.js";
import { prisma } from "../../config/database.js";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import type { AuthenticatedActor } from "../../common/contracts/actor.js";
import type { RequestSecurityContext } from "../../common/contracts/request-security.js";
import { appendAuditEvent } from "../audit/audit.service.js";
import { assertServiceAdministrator } from "./service-operations.policy.js";
import {
  serviceOperationConflict,
  serviceOperationNotFound,
  staleServiceOperation,
} from "./service-operations.errors.js";
import type {
  ServiceCategoryCreate,
  ServiceCategoryUpdate,
} from "./service-discovery.schemas.js";

export async function validateServiceCategoryAssignment(
  tx: Prisma.TransactionClient,
  id: string | null | undefined,
) {
  if (!id) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service-category:${id}`}, 0))`;
  const category = await tx.serviceCategory.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!category?.isActive)
    throw serviceOperationConflict("Choose an active service category");
}

async function structureState(tx: Prisma.TransactionClient) {
  const categories = await tx.serviceCategory.findMany({ orderBy: { id: "asc" } });
  const tyre = await tx.service.findUnique({
    where: { slug: "tyre-change" },
    select: { id: true, name: true, version: true, categoryId: true },
  });
  let groups;
  try {
    groups = planOwnerServiceGroups(categories);
  } catch {
    throw serviceOperationConflict(
      "Existing service groups overlap. Review their names before applying the owner structure.",
    );
  }
  const wheel = groups[0]!;
  if (tyre && tyre.name !== "Tyre Change")
    throw serviceOperationConflict(
      "The tyre-change URL belongs to a differently named service. Review it before continuing.",
    );
  if (tyre?.categoryId && tyre.categoryId !== wheel.id)
    throw serviceOperationConflict(
      "Tyre Change already belongs to another group. Review its association before continuing.",
    );
  const revision = createHash("sha256")
    .update(
      JSON.stringify({
        categories: categories.filter((row) =>
          groups.some((group) => group.id === row.id),
        ),
        tyre,
      }),
    )
    .digest("hex");
  return {
    revision,
    groups: groups.map((group) => ({
      ...group,
      isActive: group.id ? categories.find((row) => row.id === group.id)!.isActive : true,
    })),
    tyre,
  };
}

export class ServiceCategoryService {
  constructor(private readonly db: PrismaClient = prisma) {}
  async previewOwnerStructure(actor: AuthenticatedActor) {
    assertServiceAdministrator(actor);
    return this.db.$transaction((tx) => structureState(tx), {
      isolationLevel: "RepeatableRead",
    });
  }
  async applyOwnerStructure(
    actor: AuthenticatedActor,
    expectedRevision: string,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('service-category-structure', 0))`;
      const plan = await structureState(tx);
      if (plan.revision !== expectedRevision) throw staleServiceOperation();
      const ids: string[] = [];
      let created = 0;
      for (const group of plan.groups) {
        if (group.id) {
          ids.push(group.id);
          continue;
        }
        const row = await tx.serviceCategory.create({
          data: {
            name: group.name,
            slug: group.slug,
            description: group.description,
            isActive: true,
          },
        });
        ids.push(row.id);
        created++;
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "CREATE",
          entityType: "SERVICE_CATEGORY",
          entityId: row.id,
          newValues: { active: true, source: "owner-structure-20261030" },
          context,
        });
      }
      let assigned = false;
      if (plan.tyre && !plan.tyre.categoryId) {
        await validateServiceCategoryAssignment(tx, ids[0]!);
        const result = await tx.service.updateMany({
          where: { id: plan.tyre.id, version: plan.tyre.version, categoryId: null },
          data: { categoryId: ids[0]!, version: { increment: 1 } },
        });
        if (result.count !== 1) throw staleServiceOperation();
        assigned = true;
        await appendAuditEvent(tx, {
          actorUserId: actor.userId,
          action: "UPDATE",
          entityType: "SERVICE",
          entityId: plan.tyre.id,
          oldValues: { categoryId: null },
          newValues: { categoryId: ids[0]!, source: "owner-structure-20261030" },
          context,
        });
      }
      return {
        created,
        reused: 8 - created,
        assigned,
        serviceId: plan.tyre?.id ?? null,
        categoryIds: ids,
      };
    });
  }
  async create(
    actor: AuthenticatedActor,
    input: ServiceCategoryCreate,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('service-category-structure', 0))`;
      const row = await tx.serviceCategory.create({
        data: {
          name: input.name,
          slug: input.slug,
          isActive: input.isActive,
          description: input.description ?? null,
        },
      });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: "CREATE",
        entityType: "SERVICE_CATEGORY",
        entityId: row.id,
        newValues: { active: row.isActive },
        context,
      });
      return row;
    });
  }
  async update(
    actor: AuthenticatedActor,
    id: string,
    input: ServiceCategoryUpdate,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('service-category-structure', 0))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`service-category:${id}`}, 0))`;
      const existing = await tx.serviceCategory.findUnique({ where: { id } });
      if (!existing) throw serviceOperationNotFound();
      const { expectedVersion, ...fields } = input;
      const data = Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ) as Prisma.ServiceCategoryUpdateManyMutationInput;
      const result = await tx.serviceCategory.updateMany({
        where: { id, version: expectedVersion },
        data: { ...data, version: { increment: 1 } },
      });
      if (result.count !== 1) throw staleServiceOperation();
      const row = await tx.serviceCategory.findUniqueOrThrow({ where: { id } });
      await appendAuditEvent(tx, {
        actorUserId: actor.userId,
        action: input.isActive === undefined ? "UPDATE" : "STATUS_CHANGE",
        entityType: "SERVICE_CATEGORY",
        entityId: id,
        oldValues: { version: existing.version, active: existing.isActive },
        newValues: {
          version: row.version,
          active: row.isActive,
          changedFields: Object.keys(fields).sort().join(","),
        },
        context,
      });
      return row;
    });
  }
}
