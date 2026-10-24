import { fitmentProductWhere, selectionFromQuery } from "../fitment/fitment.engine.js";
import { z } from "zod";
import { prisma } from "../../config/database.js";
import { Prisma, type PrismaClient } from "../../generated/prisma/client.js";
import {
  catalogueBinding,
  decodeCatalogueCursor,
  encodeCatalogueCursor,
  invalidCatalogueCursor,
} from "../../common/security/catalogue-cursors.js";
import { productOrder, productSelect, productWhere } from "./catalog.repository.js";
import type {
  ProductDiscoveryQuery,
  ProductFacetQuery,
} from "./product-discovery.schemas.js";

const positionSchema = z.object({ id: z.uuid(), value: z.string().max(180) }).strict();
function valueOf(
  row: { createdAt: Date; priceKobo: bigint; name: string },
  sort: ProductDiscoveryQuery["sort"],
) {
  return sort === "newest"
    ? row.createdAt.toISOString()
    : sort === "name"
      ? row.name
      : row.priceKobo.toString();
}
function afterPosition(
  p: z.infer<typeof positionSchema>,
  sort: ProductDiscoveryQuery["sort"],
): Prisma.ProductWhereInput {
  if (sort === "newest") {
    if (!z.iso.datetime().safeParse(p.value).success) throw invalidCatalogueCursor();
    const date = new Date(p.value);
    return { OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: p.id } }] };
  }
  if (sort === "name")
    return { OR: [{ name: { gt: p.value } }, { name: p.value, id: { gt: p.id } }] };
  if (!/^(?:0|[1-9][0-9]{0,15})$/.test(p.value)) throw invalidCatalogueCursor();
  const priceKobo = BigInt(p.value);
  return {
    OR: [
      { priceKobo: sort === "price_asc" ? { gt: priceKobo } : { lt: priceKobo } },
      { priceKobo, id: sort === "price_asc" ? { gt: p.id } : { lt: p.id } },
    ],
  };
}

export class ProductDiscoveryRepository {
  constructor(private readonly db: PrismaClient = prisma) {}
  async products(query: ProductDiscoveryQuery) {
    const binding = catalogueBinding("product-discovery", query);
    const available: Prisma.InventoryWhereInput = {
      branch: { isActive: true },
      quantity: { gt: this.db.inventory.fields.reserved },
    };
    const visibility: Prisma.ProductWhereInput = {
      ...productWhere(query, true),
      ...(query.minPriceKobo !== undefined || query.maxPriceKobo !== undefined
        ? {
            priceKobo: {
              ...(query.minPriceKobo !== undefined
                ? { gte: BigInt(query.minPriceKobo) }
                : {}),
              ...(query.maxPriceKobo !== undefined
                ? { lte: BigInt(query.maxPriceKobo) }
                : {}),
            },
          }
        : {}),
      ...(query.availability === undefined
        ? {}
        : {
            inventories:
              query.availability === "in_stock"
                ? { some: available }
                : { none: available },
          }),
    };
    return this.db.$transaction(
      async (tx) => {
        let position;
        if (query.cursor) {
          if (z.uuid().safeParse(query.cursor).success) {
            const anchor = await tx.product.findFirst({
              where: { AND: [visibility, { id: query.cursor }] },
              select: { id: true, name: true, createdAt: true, priceKobo: true },
            });
            if (!anchor) throw invalidCatalogueCursor();
            position = { id: anchor.id, value: valueOf(anchor, query.sort) };
          } else position = decodeCatalogueCursor(binding, query.cursor, positionSchema);
        }
        const rows = await tx.product.findMany({
          where: position
            ? { AND: [visibility, afterPosition(position, query.sort)] }
            : visibility,
          select: productSelect,
          orderBy: productOrder(query.sort),
          take: query.limit + 1,
        });
        const totalMatches = await tx.product.count({ where: visibility });
        const selection = selectionFromQuery(query);
        const verifiedMatches = selection
          ? query.fitment === "verified"
            ? totalMatches
            : await tx.product.count({
                where: { AND: [visibility, fitmentProductWhere(selection, true)] },
              })
          : undefined;
        const items = rows.slice(0, query.limit),
          last = items.at(-1);
        return {
          items,
          totalMatches,
          ...(verifiedMatches === undefined ? {} : { verifiedMatches }),
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

  async facets(query: ProductFacetQuery) {
    const binding = catalogueBinding("product-facets", query);
    const after = query.cursor
      ? decodeCatalogueCursor(
          binding,
          query.cursor,
          z
            .object({
              key: z.string().min(1).max(120),
              value: z.string().min(1).max(120),
            })
            .strict(),
        )
      : undefined;
    const compatibility = query.field === "make" || query.field === "model";
    // Only fixed SQL fragments determine identifiers; request values remain parameters.
    const column =
      query.field === "category"
        ? Prisma.sql`c."name"`
        : query.field === "brand"
          ? Prisma.sql`p."brand"`
          : query.field === "make"
            ? Prisma.sql`v."make"`
            : Prisma.sql`v."model"`;
    const key = Prisma.sql`lower(${column}) COLLATE "C"`;
    const value = query.field === "category" ? Prisma.sql`c."id"::text COLLATE "C"` : key;
    const clauses = [
      Prisma.sql`p."isActive" = true AND c."isActive" = true AND (c."parentId" IS NULL OR EXISTS (SELECT 1 FROM "Category" parent WHERE parent."id" = c."parentId" AND parent."isActive" = true))`,
      Prisma.sql`${column} IS NOT NULL AND ${column} <> ''`,
    ];
    if (compatibility)
      clauses.push(Prisma.sql`v."reviewStatus" = 'APPROVED' AND v."effect" = 'INCLUDE'`);
    if (query.categoryId)
      clauses.push(
        Prisma.sql`(c."id" = ${query.categoryId}::uuid OR c."parentId" = ${query.categoryId}::uuid)`,
      );
    if (query.make)
      clauses.push(
        Prisma.sql`lower(v."make") COLLATE "C" = lower(${query.make}) COLLATE "C"`,
      );
    if (query.search)
      clauses.push(
        Prisma.sql`${key} LIKE lower(${query.search.replace(/[\\%_]/g, "\\$&") + "%"}) COLLATE "C"`,
      );
    if (after)
      clauses.push(
        Prisma.sql`(${key} > ${after.key} COLLATE "C" OR (${key} = ${after.key} COLLATE "C" AND ${value} > ${after.value} COLLATE "C"))`,
      );
    const rows = await this.db.$queryRaw<
      { value: string; label: string; key: string }[]
    >(Prisma.sql`
      SELECT ${value} AS value, min(${column} COLLATE "C") AS label, ${key} AS key
      FROM "Product" p JOIN "Category" c ON c."id" = p."categoryId"
      ${compatibility ? Prisma.sql`JOIN "ProductCompatibility" v ON v."productId" = p."id"` : Prisma.empty}
      WHERE ${Prisma.join(clauses, " AND ")}
      GROUP BY ${value}, ${key} ORDER BY key ASC, value ASC LIMIT ${query.limit + 1}`);
    const visible = rows.slice(0, query.limit),
      last = visible.at(-1);
    return {
      items: visible.map(({ value: v, label }) => ({ value: v, label })),
      ...(rows.length > query.limit && last
        ? {
            nextCursor: encodeCatalogueCursor(binding, {
              key: last.key,
              value: last.value,
            }),
          }
        : {}),
    };
  }
}
