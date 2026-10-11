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

export class ServiceCategoryService {
  constructor(private readonly db: PrismaClient = prisma) {}
  async create(
    actor: AuthenticatedActor,
    input: ServiceCategoryCreate,
    context: RequestSecurityContext,
  ) {
    assertServiceAdministrator(actor);
    return this.db.$transaction(async (tx) => {
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
