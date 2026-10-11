import { z } from "zod";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  catalogueBinding,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  invalidCatalogueCursor,
} from "../../common/security/catalogue-cursors.js";
import {
  projectCatalogueService,
  serviceCatalogueSelect,
} from "./service-operations.repository.js";
import { serviceOperationNotFound } from "./service-operations.errors.js";
import type {
  ServiceDiscoveryQuery,
  ServiceCategoryQuery,
} from "./service-discovery.schemas.js";

const positionSchema = z
  .object({ id: z.uuid(), value: z.string().max(160).nullable() })
  .strict();
const categoryPosition = z
  .object({ id: z.uuid(), name: z.string().min(1).max(120) })
  .strict();
const literal = (value: string) => value.replace(/[\\%_]/g, "\\$&");
function valueOf(
  row: { name: string; createdAt: Date; durationMinutes: number | null },
  sort: ServiceDiscoveryQuery["sort"],
) {
  return sort === "newest"
    ? row.createdAt.toISOString()
    : sort === "name"
      ? row.name
      : (row.durationMinutes?.toString() ?? null);
}
function after(
  p: z.infer<typeof positionSchema>,
  sort: ServiceDiscoveryQuery["sort"],
): Prisma.ServiceWhereInput {
  if (sort === "newest") {
    if (!z.iso.datetime().safeParse(p.value).success) throw invalidCatalogueCursor();
    const date = new Date(p.value!);
    return { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: p.id } }] };
  }
  if (sort === "name") {
    if (p.value === null) throw invalidCatalogueCursor();
    return { OR: [{ name: { gt: p.value } }, { name: p.value, id: { gt: p.id } }] };
  }
  if (p.value === null) return { durationMinutes: null, id: { gt: p.id } };
  if (!/^\d{1,10}$/.test(p.value) || Number(p.value) > 2147483647)
    throw invalidCatalogueCursor();
  const durationMinutes = Number(p.value);
  return {
    OR: [
      { durationMinutes: { gt: durationMinutes } },
      { durationMinutes, id: { gt: p.id } },
      { durationMinutes: null },
    ],
  };
}
export class ServiceDiscoveryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  async services(query: ServiceDiscoveryQuery) {
    const binding = catalogueBinding("service-discovery", query);
    const where: Prisma.ServiceWhereInput = {
      isActive: true,
      ...(query.pricingType ? { pricingType: query.pricingType } : {}),
      ...(query.categoryId
        ? { categoryId: query.categoryId, category: { isActive: true } }
        : {}),
      ...(query.search
        ? {
            OR: ["name", "shortDescription", "description"].map((field) => ({
              [field]: { contains: literal(query.search!), mode: "insensitive" },
            })),
          }
        : {}),
    };
    return this.db.$transaction(
      async (tx) => {
        let position;
        if (query.cursor) {
          if (z.uuid().safeParse(query.cursor).success) {
            const row = await tx.service.findFirst({
              where: { AND: [where, { id: query.cursor }] },
              select: { id: true, name: true, createdAt: true, durationMinutes: true },
            });
            if (!row) throw invalidCatalogueCursor();
            position = { id: row.id, value: valueOf(row, query.sort) };
          } else position = decodeCatalogueCursor(binding, query.cursor, positionSchema);
        }
        const orderBy: Prisma.ServiceOrderByWithRelationInput[] =
          query.sort === "newest"
            ? [{ createdAt: "desc" }, { id: "desc" }]
            : query.sort === "duration_asc"
              ? [{ durationMinutes: { sort: "asc", nulls: "last" } }, { id: "asc" }]
              : [{ name: "asc" }, { id: "asc" }];
        const rows = await tx.service.findMany({
          where: position ? { AND: [where, after(position, query.sort)] } : where,
          orderBy,
          select: serviceCatalogueSelect,
          take: query.limit + 1,
        });
        const totalMatches = await tx.service.count({ where });
        const visible = rows.slice(0, query.limit),
          last = visible.at(-1);
        return {
          items: visible.map((row) => ({
            ...projectCatalogueService(row, true),
            priceKobo: row.priceKobo?.toString() ?? null,
          })),
          totalMatches,
          ...(rows.length > query.limit && last
            ? {
                nextCursor: encodeCatalogueCursor(binding, {
                  id: last.id,
                  value: valueOf(last, query.sort),
                }),
              }
            : {}),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async categories(query: ServiceCategoryQuery, publicRead: boolean) {
    const binding = catalogueBinding(
      publicRead ? "public-service-categories" : "admin-service-categories",
      query,
    );
    const position = query.cursor
      ? decodeCatalogueCursor(binding, query.cursor, categoryPosition)
      : undefined;
    const rows = await this.db.serviceCategory.findMany({
      where: {
        ...(publicRead
          ? { isActive: true, services: { some: { isActive: true } } }
          : query.isActive === undefined
            ? {}
            : { isActive: query.isActive }),
        ...(query.search
          ? { name: { startsWith: literal(query.search), mode: "insensitive" } }
          : {}),
        ...(position
          ? {
              OR: [
                { name: { gt: position.name } },
                { name: position.name, id: { gt: position.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit),
      last = items.at(-1);
    return {
      items: publicRead ? items.map(({ id, name, slug }) => ({ id, name, slug })) : items,
      ...(rows.length > query.limit && last
        ? { nextCursor: encodeCatalogueCursor(binding, { id: last.id, name: last.name }) }
        : {}),
    };
  }
  async publicCategory(id: string) {
    const row = await this.db.serviceCategory.findFirst({
      where: { id, isActive: true, services: { some: { isActive: true } } },
      select: { id: true, name: true, slug: true },
    });
    if (!row) throw serviceOperationNotFound();
    return row;
  }
}
